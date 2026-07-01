import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
    PrivateKey,
    FileInfoQuery,
    FileContentsQuery,
    type Client,
} from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import { FileService } from "../../../../src/services/index.js";

/**
 * Integration tests for `FileUpdateOperation`.
 *
 * Each test creates a fresh operator-owned file so updates run in
 * isolation. State is verified via `FileInfoQuery` and
 * `FileContentsQuery` directly against the consensus node.
 */
describe("FileUpdateOperation", () => {
    let client: Client;
    let fileService: FileService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = ctx.client;
        fileService = new FileService(ctx);
    });

    let fileId: string;
    beforeEach(async () => {
        fileId = await fileService.createFile({
            contents: "initial contents",
            fileMemo: "initial memo",
        });
    });

    it("updates the file memo", async () => {
        await fileService.updateFile({
            fileId,
            fileMemo: "updated memo",
        });

        const info = await new FileInfoQuery()
            .setFileId(fileId)
            .execute(client);
        expect(info.fileMemo).toBe("updated memo");
    });

    it("replaces file contents (small payload, single-tx)", async () => {
        await fileService.updateFile({
            fileId,
            contents: "brand new contents",
        });

        const bytes = await new FileContentsQuery()
            .setFileId(fileId)
            .execute(client);
        expect(Buffer.from(bytes).toString("utf8")).toBe("brand new contents");
    });

    it("replaces file contents with a large payload (auto-append)", async () => {
        const size = 6 * 1024; // Well past the ~4 KiB single-tx limit.
        const large = Buffer.alloc(size, 0x63); // "cccc..."

        await fileService.updateFile({ fileId, contents: large });

        const bytes = await new FileContentsQuery()
            .setFileId(fileId)
            .execute(client);
        expect(bytes.byteLength).toBe(size);
        expect(bytes[0]).toBe(0x63);
        expect(bytes[size - 1]).toBe(0x63);
    });

    it("rotates the file's keys (both old and new keys sign)", async () => {
        // Recreate the file under a rotatable custom key so we can rotate
        // and prove the new key alone suffices afterwards.
        const oldKey = PrivateKey.generateED25519();
        const newKey = PrivateKey.generateED25519();
        const customFileId = await fileService.createFile({
            contents: "rotatable",
            keys: [oldKey.publicKey],
        });

        await fileService.updateFile({
            fileId: customFileId,
            keys: [newKey.publicKey],
            additionalSigners: [oldKey, newKey],
        });

        // The old key alone must no longer suffice.
        await expect(
            fileService.updateFile({
                fileId: customFileId,
                fileMemo: "with old key",
                additionalSigners: [oldKey],
            }),
        ).rejects.toThrow();

        // The new key alone now suffices.
        await fileService.updateFile({
            fileId: customFileId,
            fileMemo: "with new key",
            additionalSigners: [newKey],
        });

        const info = await new FileInfoQuery()
            .setFileId(customFileId)
            .execute(client);
        expect(info.fileMemo).toBe("with new key");
    });

    it("extends the expirationTime", async () => {
        // ~120 days out — comfortably past the current expiration.
        const expirationTime = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000);

        await fileService.updateFile({
            fileId,
            expirationTime,
        });

        const info = await new FileInfoQuery()
            .setFileId(fileId)
            .execute(client);
        expect(info.expirationTime.toDate().toISOString().slice(0, 10)).toBe(
            expirationTime.toISOString().slice(0, 10),
        );
    });

    it("rejects a no-op update (no field to change)", async () => {
        await expect(fileService.updateFile({ fileId })).rejects.toThrow(
            /updateFile requires at least one field to change/,
        );
    });

    it("rejects an update to a non-existent file", async () => {
        await expect(
            fileService.updateFile({
                fileId: "0.0.999999999",
                fileMemo: "no such file",
            }),
        ).rejects.toThrow();
    });
});
