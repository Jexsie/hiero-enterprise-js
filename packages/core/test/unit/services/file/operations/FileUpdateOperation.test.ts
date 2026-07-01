import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    FileUpdateTransaction,
    FileAppendTransaction,
    PrivateKey,
} from "@hiero-ledger/sdk";
import { FileService } from "../../../../../src/services/file/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return {
        update: buildMockTxBundle([
            "setFileId",
            "setContents",
            "setKeys",
            "setFileMemo",
            "setExpirationTime",
        ]),
        append: buildMockTxBundle([
            "setFileId",
            "setContents",
            "setMaxChunks",
            "setChunkSize",
            "setChunkInterval",
        ]),
    };
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        FileUpdateTransaction: vi.fn(function () {
            return mocks.update.tx;
        }),
        FileAppendTransaction: vi.fn(function () {
            return mocks.append.tx;
        }),
    };
});

describe("FileUpdateOperation (via FileService)", () => {
    let context: IHieroContext;
    let service: FileService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks.update);
        reattachMockChain(mocks.append);
        context = createMockContext();
        service = new FileService(context);
    });

    describe("updateFile", () => {
        it("submits a FileUpdateTransaction touching only changed fields", async () => {
            await service.updateFile({
                fileId: "0.0.555",
                fileMemo: "renamed",
            });

            const tx = vi.mocked(FileUpdateTransaction).mock.results[0].value;
            expect(tx.setFileId).toHaveBeenCalledWith("0.0.555");
            expect(tx.setFileMemo).toHaveBeenCalledWith("renamed");
            expect(tx.setContents).not.toHaveBeenCalled();
            expect(tx.setKeys).not.toHaveBeenCalled();
            expect(tx.setExpirationTime).not.toHaveBeenCalled();
            expect(tx.execute).toHaveBeenCalledWith(context.client);
            expect(vi.mocked(FileAppendTransaction)).not.toHaveBeenCalled();
        });

        it("writes the empty-string memo sentinel when fileMemo is null", async () => {
            // The SDK has no `clearFileMemo()`; the operation routes
            // `null` through `setFileMemo("")` — the canonical Hedera
            // clear sentinel.
            await service.updateFile({
                fileId: "0.0.555",
                fileMemo: null,
            });

            const tx = vi.mocked(FileUpdateTransaction).mock.results[0].value;
            expect(tx.setFileMemo).toHaveBeenCalledWith("");
        });

        it("forwards a new keys list", async () => {
            const newKey = PrivateKey.generateED25519().publicKey;

            await service.updateFile({
                fileId: "0.0.555",
                keys: [newKey],
            });

            const tx = vi.mocked(FileUpdateTransaction).mock.results[0].value;
            expect(tx.setKeys).toHaveBeenCalledWith([newKey]);
        });

        it("forwards an empty keys list (rotate to unmodifiable)", async () => {
            await service.updateFile({
                fileId: "0.0.555",
                keys: [],
            });

            const tx = vi.mocked(FileUpdateTransaction).mock.results[0].value;
            expect(tx.setKeys).toHaveBeenCalledWith([]);
        });

        it("forwards expirationTime", async () => {
            const expirationTime = new Date("2099-01-01T00:00:00Z");

            await service.updateFile({
                fileId: "0.0.555",
                expirationTime,
            });

            const tx = vi.mocked(FileUpdateTransaction).mock.results[0].value;
            expect(tx.setExpirationTime).toHaveBeenCalledWith(expirationTime);
        });

        it("submits contents-only updates that fit in a single tx without appending", async () => {
            await service.updateFile({
                fileId: "0.0.555",
                contents: "small replacement",
            });

            const tx = vi.mocked(FileUpdateTransaction).mock.results[0].value;
            expect(tx.setContents).toHaveBeenCalledWith("small replacement");
            expect(vi.mocked(FileAppendTransaction)).not.toHaveBeenCalled();
        });

        it("chains a FileAppendTransaction when contents exceed the per-tx limit", async () => {
            const large = Buffer.alloc(4200, 0x62);

            await service.updateFile({
                fileId: "0.0.555",
                contents: large,
            });

            const updateTx = vi.mocked(FileUpdateTransaction).mock.results[0]
                .value;
            const appendTx = vi.mocked(FileAppendTransaction).mock.results[0]
                .value;

            const updateArg = vi.mocked(updateTx.setContents).mock
                .calls[0][0] as Uint8Array;
            expect(updateArg.byteLength).toBe(4096);

            expect(appendTx.setFileId).toHaveBeenCalledWith("0.0.555");
            const appendArg = vi.mocked(appendTx.setContents).mock
                .calls[0][0] as Uint8Array;
            expect(appendArg.byteLength).toBe(4200 - 4096);
        });

        it("applies base TransactionOptions to the update transaction", async () => {
            await service.updateFile({
                fileId: "0.0.555",
                fileMemo: "x",
                transactionMemo: "base memo",
                transactionValidDuration: 90,
                regenerateTransactionId: false,
            });

            const tx = vi.mocked(FileUpdateTransaction).mock.results[0].value;
            expect(tx.setTransactionMemo).toHaveBeenCalledWith("base memo");
            expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(90);
            expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        });

        it("freezes and signs with additionalSigners before execute", async () => {
            const key = PrivateKey.generateED25519();

            await service.updateFile({
                fileId: "0.0.555",
                fileMemo: "signed update",
                additionalSigners: [key],
            });

            const tx = vi.mocked(FileUpdateTransaction).mock.results[0].value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(key);
        });

        it("rejects a no-op update before touching the SDK", async () => {
            await expect(
                service.updateFile({ fileId: "0.0.555" }),
            ).rejects.toThrow(
                /updateFile requires at least one field to change/,
            );

            expect(vi.mocked(FileUpdateTransaction)).not.toHaveBeenCalled();
        });

        it("rejects expirationTime: null before touching the SDK", async () => {
            await expect(
                service.updateFile({
                    fileId: "0.0.555",
                    expirationTime: null,
                } as unknown as Parameters<typeof service.updateFile>[0]),
            ).rejects.toThrow(/expirationTime cannot be null/);

            expect(vi.mocked(FileUpdateTransaction)).not.toHaveBeenCalled();
        });
    });

    describe("scheduleUpdateFile", () => {
        it("schedules a FileUpdate and returns the scheduleId", async () => {
            const result = await service.scheduleUpdateFile({
                fileId: "0.0.555",
                fileMemo: "renamed",
            });

            expect(result.scheduleId).toBe("0.0.777");
            expect(result.transactionId).toBe("0.0.123@1234567890.000000000");

            const tx = vi.mocked(FileUpdateTransaction).mock.results[0].value;
            expect(tx.schedule).toHaveBeenCalled();
        });

        it("rejects contents exceeding the per-tx limit (no atomic chunked scheduling)", async () => {
            const large = Buffer.alloc(4097, 0x62);

            await expect(
                service.scheduleUpdateFile({
                    fileId: "0.0.555",
                    contents: large,
                }),
            ).rejects.toThrow(
                /scheduleUpdateFile does not support contents larger than/,
            );

            expect(vi.mocked(FileUpdateTransaction)).not.toHaveBeenCalled();
        });

        it("passes small contents through (fits in single transaction)", async () => {
            const result = await service.scheduleUpdateFile({
                fileId: "0.0.555",
                contents: "small update",
            });

            expect(result.scheduleId).toBe("0.0.777");

            const tx = vi.mocked(FileUpdateTransaction).mock.results[0].value;
            expect(tx.setContents).toHaveBeenCalledWith("small update");
            expect(tx.schedule).toHaveBeenCalled();
        });

        it("propagates validator errors before touching the SDK", async () => {
            await expect(
                service.scheduleUpdateFile({ fileId: "0.0.555" }),
            ).rejects.toThrow(
                /updateFile requires at least one field to change/,
            );

            expect(vi.mocked(FileUpdateTransaction)).not.toHaveBeenCalled();
        });
    });
});
