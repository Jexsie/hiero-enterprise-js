import { describe, it, expect, beforeEach, vi } from "vitest";
import { TokenRepository } from "../../../src/repositories/token-repository.js";
import { createMockMirrorNodeClient } from "../../utils/mock-mirror-node.js";
import type { MirrorNodeClient } from "../../../src/mirror/index.js";

describe("TokenRepository", () => {
    let repo: TokenRepository;
    let mockClient: ReturnType<typeof createMockMirrorNodeClient>;

    beforeEach(() => {
        mockClient = createMockMirrorNodeClient();
        repo = new TokenRepository(mockClient as unknown as MirrorNodeClient);
    });

    it("delegates findById to queryTokenById", async () => {
        const spy = vi.spyOn(mockClient, "queryTokenById");
        await repo.findById("0.0.555");
        expect(spy).toHaveBeenCalledWith("0.0.555");
    });
});
