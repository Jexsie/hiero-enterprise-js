import { describe, it, expect, vi, beforeEach } from "vitest";
import { NftId, TokenId } from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = vi.hoisted(() => {
    const mockQuery = {
        setNftId: vi.fn().mockReturnThis(),
        execute: vi.fn(),
    };
    return { mockQuery };
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TokenNftInfoQuery: vi.fn(function () {
            return mocks.mockQuery;
        }),
    };
});

// Re-imported after vi.mock so the SdkTokenNftInfoQuery constructor is the mock.
const { TokenNftInfoQuery: SdkTokenNftInfoQuery } =
    await import("@hiero-ledger/sdk");

function buildSdkNftInfo(overrides: Record<string, unknown> = {}) {
    const tokenId = TokenId.fromString("0.0.1234");
    return {
        nftId: new NftId(tokenId, 7),
        accountId: { toString: () => "0.0.555" },
        creationTime: {
            toDate: () => new Date("2024-01-02T03:04:05.000Z"),
        },
        metadata: new Uint8Array([1, 2, 3]),
        spenderId: { toString: () => "0.0.999" },
        ledgerId: { toString: () => "testnet" },
        ...overrides,
    };
}

describe("TokenNftInfoQuery (via TokenService)", () => {
    let context: IHieroContext;
    let service: TokenService;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createMockContext();
        service = new TokenService(context);
    });

    it("fetches and projects the first NFT info entry to a plain object", async () => {
        mocks.mockQuery.execute.mockResolvedValueOnce([buildSdkNftInfo()]);

        const info = await service.getNftInfo("0.0.1234/7");

        expect(mocks.mockQuery.setNftId).toHaveBeenCalledWith("0.0.1234/7");
        expect(mocks.mockQuery.execute).toHaveBeenCalledWith(context.client);

        expect(info).toEqual({
            nftId: "0.0.1234/7",
            tokenId: "0.0.1234",
            serial: "7",
            accountId: "0.0.555",
            creationTime: "2024-01-02T03:04:05.000Z",
            metadata: new Uint8Array([1, 2, 3]),
            spenderId: "0.0.999",
            ledgerId: "testnet",
        });
    });

    it("accepts an NftId instance", async () => {
        const nftId = new NftId(TokenId.fromString("0.0.4321"), 3);
        mocks.mockQuery.execute.mockResolvedValueOnce([
            buildSdkNftInfo({
                nftId,
                accountId: { toString: () => "0.0.700" },
            }),
        ]);

        const info = await service.getNftInfo(nftId);

        expect(mocks.mockQuery.setNftId).toHaveBeenCalledWith(nftId);
        expect(info.nftId).toBe("0.0.4321/3");
        expect(info.tokenId).toBe("0.0.4321");
        expect(info.serial).toBe("3");
        expect(info.accountId).toBe("0.0.700");
    });

    it("returns null for optional fields when the SDK reports them as null", async () => {
        mocks.mockQuery.execute.mockResolvedValueOnce([
            buildSdkNftInfo({
                metadata: null,
                spenderId: null,
                ledgerId: null,
            }),
        ]);

        const info = await service.getNftInfo("0.0.1234/7");

        expect(info.metadata).toBeNull();
        expect(info.spenderId).toBeNull();
        expect(info.ledgerId).toBeNull();
    });

    it("throws a NotFound HieroError when the SDK returns an empty list", async () => {
        mocks.mockQuery.execute.mockResolvedValueOnce([]);

        await expect(service.getNftInfo("0.0.1234/7")).rejects.toMatchObject({
            name: "HieroError",
            code: "NOT_FOUND",
            context: "TokenService.getNftInfo",
        });
    });

    it("normalises SDK errors with the TokenService.getNftInfo context", async () => {
        mocks.mockQuery.execute.mockRejectedValueOnce(
            new Error("network is down"),
        );

        await expect(service.getNftInfo("0.0.1234/7")).rejects.toMatchObject({
            name: "HieroError",
            context: "TokenService.getNftInfo",
            message: "network is down",
        });
    });

    it("constructs a fresh SdkTokenNftInfoQuery on every execute call", async () => {
        mocks.mockQuery.execute.mockResolvedValue([buildSdkNftInfo()]);

        await service.getNftInfo("0.0.1/1");
        await service.getNftInfo("0.0.2/2");

        expect(vi.mocked(SdkTokenNftInfoQuery)).toHaveBeenCalledTimes(2);
    });
});
