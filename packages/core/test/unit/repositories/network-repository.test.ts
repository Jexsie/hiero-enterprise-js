import { describe, it, expect, beforeEach, vi } from "vitest";
import { NetworkRepository } from "../../../src/repositories/network-repository.js";
import { createMockMirrorNodeClient } from "../../utils/mock-mirror-node.js";
import type { MirrorNodeClient } from "../../../src/mirror/index.js";

describe("NetworkRepository", () => {
    let repo: NetworkRepository;
    let mockClient: ReturnType<typeof createMockMirrorNodeClient>;

    beforeEach(() => {
        mockClient = createMockMirrorNodeClient();
        repo = new NetworkRepository(mockClient as unknown as MirrorNodeClient);
    });

    it("delegates findExchangeRates to queryExchangeRates", async () => {
        const spy = vi.spyOn(mockClient, "queryExchangeRates");
        await repo.findExchangeRates();
        expect(spy).toHaveBeenCalled();
    });

    it("delegates findNetworkSupplies to queryNetworkSupplies", async () => {
        const spy = vi.spyOn(mockClient, "queryNetworkSupplies");
        await repo.findNetworkSupplies();
        expect(spy).toHaveBeenCalled();
    });

    it("delegates findStakingRewards to queryNetworkStake", async () => {
        const spy = vi.spyOn(mockClient, "queryNetworkStake");
        await repo.findStakingRewards();
        expect(spy).toHaveBeenCalled();
    });
});
