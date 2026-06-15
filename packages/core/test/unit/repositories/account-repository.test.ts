import { describe, it, expect, beforeEach, vi } from "vitest";
import { AccountRepository } from "../../../src/repositories/account-repository.js";
import { createMockMirrorNodeClient } from "../../utils/mock-mirror-node.js";
import type { MirrorNodeClient } from "../../../src/mirror/index.js";

describe("AccountRepository", () => {
    let repo: AccountRepository;
    let mockClient: ReturnType<typeof createMockMirrorNodeClient>;

    beforeEach(() => {
        mockClient = createMockMirrorNodeClient();
        repo = new AccountRepository(mockClient as unknown as MirrorNodeClient);
    });

    it("delegates findByAccountId to queryAccount", async () => {
        const spy = vi.spyOn(mockClient, "queryAccount");
        await repo.findByAccountId("0.0.123");
        expect(spy).toHaveBeenCalledWith("0.0.123");
    });

    it("delegates getBalance to queryAccountBalance", async () => {
        const spy = vi.spyOn(mockClient, "queryAccountBalance");
        await repo.getBalance("0.0.123");
        expect(spy).toHaveBeenCalledWith("0.0.123");
    });
});
