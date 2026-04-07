import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../utils/env.js";
import { waitForMirrorNodeRecord } from "../utils/mirror-node.js";
import { FileClient } from "../../src/services/file-client.js";

describe("FileClient [Integration]", () => {
    let client: FileClient;
    let testFileId: string;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = new FileClient(ctx);
    });

    it("creates a file directly and dynamically handles underlying chunks", async () => {
        const content = Buffer.from(
            "Hello from Hiero Enterprise Node Integration Tests!",
        );
        const fileId = await client.createFile(content);

        expect(typeof fileId).toBe("string");
        expect(fileId).toBeDefined();

        await waitForMirrorNodeRecord(); // Allow node to sync
        testFileId = fileId;
    }, 25000);

    it("reads the file contents natively from the consensus node", async () => {
        const bytes = await client.readFile(testFileId);

        const decoded = Buffer.from(bytes).toString("utf-8");
        expect(decoded).toBe(
            "Hello from Hiero Enterprise Node Integration Tests!",
        );
    }, 20000);

    it("deletes the file from the ledger network", async () => {
        await client.deleteFile(testFileId);

        await waitForMirrorNodeRecord();

        // Asserting deletion by expecting empty contents (Hedera clears deleted file contents)
        const bytes = await client.readFile(testFileId);
        expect(bytes.length).toBe(0);

        const isDeleted = await client.isDeleted(testFileId);
        expect(isDeleted).toBe(true);
    }, 25000);
});
