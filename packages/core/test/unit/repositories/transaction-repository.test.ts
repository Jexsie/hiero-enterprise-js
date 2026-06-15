import { describe, it, expect, beforeEach, vi } from "vitest";
import { TransactionRepository } from "../../../src/repositories/transaction-repository.js";
import { createMockMirrorNodeClient } from "../../utils/mock-mirror-node.js";
import type { MirrorNodeClient } from "../../../src/mirror/index.js";

describe("TransactionRepository", () => {
    let repo: TransactionRepository;
    let mockClient: ReturnType<typeof createMockMirrorNodeClient>;

    beforeEach(() => {
        mockClient = createMockMirrorNodeClient();
        repo = new TransactionRepository(
            mockClient as unknown as MirrorNodeClient,
        );
    });

    it("delegates findByAccount to queryTransactionsByAccount", async () => {
        const spy = vi.spyOn(mockClient, "queryTransactionsByAccount");
        await repo.findByAccount("0.0.123");
        expect(spy).toHaveBeenCalledWith("0.0.123");
    });

    it("delegates findByAccountAndType to queryTransactionsByAccountAndType", async () => {
        const spy = vi.spyOn(mockClient, "queryTransactionsByAccountAndType");
        await repo.findByAccountAndType("0.0.123", "CRYPTOTRANSFER");
        expect(spy).toHaveBeenCalledWith("0.0.123", "CRYPTOTRANSFER");
    });

    it("delegates findById to queryTransaction", async () => {
        const spy = vi.spyOn(mockClient, "queryTransaction");
        await repo.findById("0.0.123@1234567890.000");
        expect(spy).toHaveBeenCalledWith("0.0.123@1234567890.000");
    });
});
