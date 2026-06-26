import { describe, it, expect, vi, beforeEach } from "vitest";
import { TokenId, TokenType, TokenSupplyType } from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = vi.hoisted(() => {
    const mockQuery = {
        setTokenId: vi.fn().mockReturnThis(),
        execute: vi.fn(),
    };
    return { mockQuery };
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TokenInfoQuery: vi.fn(function () {
            return mocks.mockQuery;
        }),
    };
});

// Re-imported after vi.mock so the SdkTokenInfoQuery constructor is the mock.
const { TokenInfoQuery: SdkTokenInfoQuery } = await import("@hiero-ledger/sdk");

function buildSdkTokenInfo(overrides: Record<string, unknown> = {}) {
    return {
        tokenId: TokenId.fromString("0.0.1234"),
        name: "Acme Coin",
        symbol: "ACME",
        decimals: 2,
        totalSupply: { toString: () => "1000000" },
        treasuryAccountId: { toString: () => "0.0.555" },
        adminKey: { _adminKeySentinel: true },
        kycKey: null,
        freezeKey: null,
        pauseKey: null,
        wipeKey: null,
        supplyKey: { _supplyKeySentinel: true },
        feeScheduleKey: null,
        metadataKey: null,
        defaultFreezeStatus: null,
        defaultKycStatus: null,
        pauseStatus: null,
        isDeleted: false,
        autoRenewAccountId: { toString: () => "0.0.555" },
        autoRenewPeriod: { seconds: { toNumber: () => 7776000 } },
        expirationTime: {
            toDate: () => new Date("2099-01-02T03:04:05.000Z"),
        },
        tokenMemo: "demo memo",
        customFees: [],
        tokenType: TokenType.FungibleCommon,
        supplyType: TokenSupplyType.Infinite,
        maxSupply: null,
        ledgerId: { toString: () => "mainnet" },
        metadata: null,
        ...overrides,
    };
}

describe("TokenInfoQuery (via TokenService)", () => {
    let context: IHieroContext;
    let service: TokenService;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createMockContext();
        service = new TokenService(context);
    });

    it("fetches and projects fungible token info to a plain object", async () => {
        mocks.mockQuery.execute.mockResolvedValueOnce(buildSdkTokenInfo());

        const info = await service.getTokenInfo("0.0.1234");

        expect(mocks.mockQuery.setTokenId).toHaveBeenCalledWith("0.0.1234");
        expect(mocks.mockQuery.execute).toHaveBeenCalledWith(context.client);

        expect(info).toMatchObject({
            tokenId: "0.0.1234",
            name: "Acme Coin",
            symbol: "ACME",
            decimals: 2,
            totalSupply: "1000000",
            treasuryAccountId: "0.0.555",
            autoRenewAccountId: "0.0.555",
            autoRenewPeriod: 7776000,
            expirationTime: "2099-01-02T03:04:05.000Z",
            tokenMemo: "demo memo",
            customFees: [],
            tokenType: TokenType.FungibleCommon,
            supplyType: TokenSupplyType.Infinite,
            maxSupply: null,
            ledgerId: "mainnet",
            metadata: null,
            isDeleted: false,
            defaultFreezeStatus: null,
            defaultKycStatus: null,
            pauseStatus: null,
        });
        // Keys pass through as the original SDK references.
        expect(info.adminKey).toEqual({ _adminKeySentinel: true });
        expect(info.supplyKey).toEqual({ _supplyKeySentinel: true });
        expect(info.kycKey).toBeNull();
        expect(info.freezeKey).toBeNull();
        expect(info.pauseKey).toBeNull();
        expect(info.wipeKey).toBeNull();
        expect(info.feeScheduleKey).toBeNull();
        expect(info.metadataKey).toBeNull();
    });

    it("accepts a TokenId instance and stringifies maxSupply when set", async () => {
        const tokenId = TokenId.fromString("0.0.999");
        mocks.mockQuery.execute.mockResolvedValueOnce(
            buildSdkTokenInfo({
                tokenId,
                supplyType: TokenSupplyType.Finite,
                maxSupply: { toString: () => "123456789" },
                tokenType: TokenType.NonFungibleUnique,
                decimals: 0,
                pauseStatus: true,
                isDeleted: true,
            }),
        );

        const info = await service.getTokenInfo(tokenId);

        expect(mocks.mockQuery.setTokenId).toHaveBeenCalledWith(tokenId);
        expect(info).toMatchObject({
            tokenId: "0.0.999",
            tokenType: TokenType.NonFungibleUnique,
            supplyType: TokenSupplyType.Finite,
            maxSupply: "123456789",
            decimals: 0,
            pauseStatus: true,
            isDeleted: true,
        });
    });

    it("returns null for optional fields when the SDK reports them as null", async () => {
        mocks.mockQuery.execute.mockResolvedValueOnce(
            buildSdkTokenInfo({
                treasuryAccountId: null,
                autoRenewAccountId: null,
                autoRenewPeriod: null,
                expirationTime: null,
                ledgerId: null,
            }),
        );

        const info = await service.getTokenInfo("0.0.1234");

        expect(info.treasuryAccountId).toBeNull();
        expect(info.autoRenewAccountId).toBeNull();
        expect(info.autoRenewPeriod).toBeNull();
        expect(info.expirationTime).toBeNull();
        expect(info.ledgerId).toBeNull();
    });

    it("normalises SDK errors with the TokenService.getTokenInfo context", async () => {
        mocks.mockQuery.execute.mockRejectedValueOnce(
            new Error("boom from network"),
        );

        await expect(service.getTokenInfo("0.0.1234")).rejects.toMatchObject({
            name: "HieroError",
            context: "TokenService.getTokenInfo",
            message: "boom from network",
        });
    });

    it("constructs a fresh SdkTokenInfoQuery on every execute call", async () => {
        mocks.mockQuery.execute.mockResolvedValue(buildSdkTokenInfo());

        await service.getTokenInfo("0.0.1");
        await service.getTokenInfo("0.0.2");

        expect(vi.mocked(SdkTokenInfoQuery)).toHaveBeenCalledTimes(2);
    });
});
