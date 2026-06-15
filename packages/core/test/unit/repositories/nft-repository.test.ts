import { describe, it, expect, beforeEach, vi } from "vitest";
import { NftRepository } from "../../../src/repositories/nft-repository.js";
import { createMockMirrorNodeClient } from "../../utils/mock-mirror-node.js";
import type { MirrorNodeClient } from "../../../src/mirror/index.js";

describe("NftRepository", () => {
    let repo: NftRepository;
    let mockClient: ReturnType<typeof createMockMirrorNodeClient>;

    beforeEach(() => {
        mockClient = createMockMirrorNodeClient();
        repo = new NftRepository(mockClient as unknown as MirrorNodeClient);
    });

    it("delegates findByOwner to queryNftsByAccount", async () => {
        const spy = vi.spyOn(mockClient, "queryNftsByAccount");
        await repo.findByOwner("0.0.123");
        expect(spy).toHaveBeenCalledWith("0.0.123");
    });

    it("delegates findBySerial to queryNftsByTokenIdAndSerial", async () => {
        const spy = vi.spyOn(mockClient, "queryNftsByTokenIdAndSerial");
        await repo.findBySerial("0.0.99", 5);
        expect(spy).toHaveBeenCalledWith("0.0.99", 5);
    });
});
