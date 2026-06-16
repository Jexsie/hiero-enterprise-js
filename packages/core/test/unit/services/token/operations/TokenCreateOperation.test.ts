import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    TokenCreateTransaction,
    TokenType,
    TokenSupplyType,
    PrivateKey,
} from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle([
        "setTokenName",
        "setTokenSymbol",
        "setTreasuryAccountId",
        "setTokenType",
        "setDecimals",
        "setInitialSupply",
        "setAdminKey",
        "setKycKey",
        "setFreezeKey",
        "setPauseKey",
        "setWipeKey",
        "setSupplyKey",
        "setFeeScheduleKey",
        "setFreezeDefault",
        "setAutoRenewAccountId",
        "setExpirationTime",
        "setAutoRenewPeriod",
        "setTokenMemo",
        "setCustomFees",
        "setSupplyType",
        "setMaxSupply",
        "setMetadataKey",
        "setMetadata",
    ]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TokenCreateTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("TokenCreateOperation (via TokenService)", () => {
    let context: IHieroContext;
    let service: TokenService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new TokenService(context);
    });

    describe("createFungibleToken", () => {
        it("creates a token and returns the token ID", async () => {
            const tokenId = await service.createFungibleToken({
                tokenName: "Acme",
                tokenSymbol: "ACME",
                treasuryAccountId: "0.0.555",
            });

            expect(tokenId).toBe("0.0.500");

            const tx = vi.mocked(TokenCreateTransaction).mock.results[0].value;
            expect(tx.setTokenName).toHaveBeenCalledWith("Acme");
            expect(tx.setTokenSymbol).toHaveBeenCalledWith("ACME");
            expect(tx.setTreasuryAccountId).toHaveBeenCalledWith("0.0.555");
            expect(tx.setTokenType).toHaveBeenCalledWith(
                TokenType.FungibleCommon,
            );
            expect(tx.execute).toHaveBeenCalledWith(context.client);
        });

        it("forwards every optional setter when the field is provided", async () => {
            const adminKey = PrivateKey.generateED25519().publicKey;
            const supplyKey = PrivateKey.generateED25519().publicKey;
            const kycKey = PrivateKey.generateED25519().publicKey;
            const freezeKey = PrivateKey.generateED25519().publicKey;
            const pauseKey = PrivateKey.generateED25519().publicKey;
            const wipeKey = PrivateKey.generateED25519().publicKey;
            const feeScheduleKey = PrivateKey.generateED25519().publicKey;
            const metadataKey = PrivateKey.generateED25519().publicKey;
            const metadata = new Uint8Array([1, 2, 3]);
            const expirationTime = new Date(Date.now() + 90 * 24 * 60 * 60_000);

            await service.createFungibleToken({
                tokenName: "Full",
                tokenSymbol: "FULL",
                treasuryAccountId: "0.0.555",
                decimals: 2,
                initialSupply: 1_000_000,
                adminKey,
                supplyKey,
                kycKey,
                freezeKey,
                pauseKey,
                wipeKey,
                feeScheduleKey,
                metadataKey,
                metadata,
                freezeDefault: false,
                autoRenewAccountId: "0.0.555",
                expirationTime,
                autoRenewPeriod: 7_776_000,
                tokenMemo: "fully configured token",
                maxSupply: 10_000_000,
            });

            const tx = vi.mocked(TokenCreateTransaction).mock.results[0].value;
            expect(tx.setDecimals).toHaveBeenCalledWith(2);
            expect(tx.setInitialSupply).toHaveBeenCalledWith(1_000_000);
            expect(tx.setAdminKey).toHaveBeenCalledWith(adminKey);
            expect(tx.setSupplyKey).toHaveBeenCalledWith(supplyKey);
            expect(tx.setKycKey).toHaveBeenCalledWith(kycKey);
            expect(tx.setFreezeKey).toHaveBeenCalledWith(freezeKey);
            expect(tx.setPauseKey).toHaveBeenCalledWith(pauseKey);
            expect(tx.setWipeKey).toHaveBeenCalledWith(wipeKey);
            expect(tx.setFeeScheduleKey).toHaveBeenCalledWith(feeScheduleKey);
            expect(tx.setMetadataKey).toHaveBeenCalledWith(metadataKey);
            expect(tx.setMetadata).toHaveBeenCalledWith(metadata);
            expect(tx.setFreezeDefault).toHaveBeenCalledWith(false);
            expect(tx.setAutoRenewAccountId).toHaveBeenCalledWith("0.0.555");
            expect(tx.setExpirationTime).toHaveBeenCalledWith(expirationTime);
            expect(tx.setAutoRenewPeriod).toHaveBeenCalledWith(7_776_000);
            expect(tx.setTokenMemo).toHaveBeenCalledWith(
                "fully configured token",
            );
            expect(tx.setMaxSupply).toHaveBeenCalledWith(10_000_000);
        });

        it("does not call optional setters when fields are omitted", async () => {
            await service.createFungibleToken({
                tokenName: "Minimal",
                tokenSymbol: "MIN",
                treasuryAccountId: "0.0.555",
            });

            const tx = vi.mocked(TokenCreateTransaction).mock.results[0].value;
            expect(tx.setDecimals).not.toHaveBeenCalled();
            expect(tx.setInitialSupply).not.toHaveBeenCalled();
            expect(tx.setAdminKey).not.toHaveBeenCalled();
            expect(tx.setSupplyKey).not.toHaveBeenCalled();
            expect(tx.setMaxSupply).not.toHaveBeenCalled();
            expect(tx.setTokenMemo).not.toHaveBeenCalled();
            expect(tx.setMetadata).not.toHaveBeenCalled();
        });

        it("skips setCustomFees when the array is empty", async () => {
            await service.createFungibleToken({
                tokenName: "Acme",
                tokenSymbol: "ACME",
                treasuryAccountId: "0.0.555",
                customFees: [],
            });

            const tx = vi.mocked(TokenCreateTransaction).mock.results[0].value;
            expect(tx.setCustomFees).not.toHaveBeenCalled();
        });

        it("applies base TransactionOptions to the transaction", async () => {
            await service.createFungibleToken({
                tokenName: "Acme",
                tokenSymbol: "ACME",
                treasuryAccountId: "0.0.555",
                transactionMemo: "base memo",
                transactionValidDuration: 90,
                regenerateTransactionId: false,
            });

            const tx = vi.mocked(TokenCreateTransaction).mock.results[0].value;
            expect(tx.setTransactionMemo).toHaveBeenCalledWith("base memo");
            expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(90);
            expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        });

        it("freezes and signs with additionalSigners before execute", async () => {
            const treasuryKey = PrivateKey.generateED25519();

            await service.createFungibleToken({
                tokenName: "Acme",
                tokenSymbol: "ACME",
                treasuryAccountId: "0.0.555",
                additionalSigners: [treasuryKey],
            });

            const tx = vi.mocked(TokenCreateTransaction).mock.results[0].value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(treasuryKey);
        });
    });

    describe("createNft", () => {
        it("creates an NFT collection with NonFungibleUnique type", async () => {
            const supplyKey = PrivateKey.generateED25519().publicKey;

            const tokenId = await service.createNft({
                tokenName: "Acme Art",
                tokenSymbol: "ART",
                treasuryAccountId: "0.0.555",
                supplyKey,
            });

            expect(tokenId).toBe("0.0.500");

            const tx = vi.mocked(TokenCreateTransaction).mock.results[0].value;
            expect(tx.setTokenType).toHaveBeenCalledWith(
                TokenType.NonFungibleUnique,
            );
            expect(tx.setDecimals).toHaveBeenCalledWith(0);
            expect(tx.setInitialSupply).toHaveBeenCalledWith(0);
            expect(tx.setSupplyKey).toHaveBeenCalledWith(supplyKey);
        });

        it("auto-sets supplyType to Finite when maxSupply is provided", async () => {
            const supplyKey = PrivateKey.generateED25519().publicKey;

            await service.createNft({
                tokenName: "Acme Art",
                tokenSymbol: "ART",
                treasuryAccountId: "0.0.555",
                supplyKey,
                maxSupply: 1_000,
            });

            const tx = vi.mocked(TokenCreateTransaction).mock.results[0].value;
            expect(tx.setSupplyType).toHaveBeenCalledWith(
                TokenSupplyType.Finite,
            );
            expect(tx.setMaxSupply).toHaveBeenCalledWith(1_000);
        });
    });

    describe("scheduleCreateFungibleToken", () => {
        it("wraps the transaction in a ScheduleCreateTransaction", async () => {
            const result = await service.scheduleCreateFungibleToken(
                {
                    tokenName: "Acme",
                    tokenSymbol: "ACME",
                    treasuryAccountId: "0.0.555",
                },
                { scheduleMemo: "pending approval" },
            );

            expect(mocks.tx.schedule).toHaveBeenCalled();
            expect(mocks.scheduleTx.setScheduleMemo).toHaveBeenCalledWith(
                "pending approval",
            );
            expect(result.scheduleId).toBe("0.0.777");
            expect(result.transactionId).toBeDefined();
        });
    });

    describe("scheduleCreateNft", () => {
        it("wraps the NFT transaction in a ScheduleCreateTransaction", async () => {
            const supplyKey = PrivateKey.generateED25519().publicKey;

            const result = await service.scheduleCreateNft(
                {
                    tokenName: "Acme Art",
                    tokenSymbol: "ART",
                    treasuryAccountId: "0.0.555",
                    supplyKey,
                },
                { scheduleMemo: "pending approval" },
            );

            expect(mocks.tx.schedule).toHaveBeenCalled();
            expect(result.scheduleId).toBe("0.0.777");
            expect(result.transactionId).toBeDefined();
        });
    });
});
