import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    TokenUpdateTransaction,
    TokenKeyValidation,
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
        "setTokenId",
        "setTokenName",
        "setTokenSymbol",
        "setTreasuryAccountId",
        "setAdminKey",
        "setKycKey",
        "setFreezeKey",
        "setWipeKey",
        "setSupplyKey",
        "setAutoRenewAccountId",
        "setExpirationTime",
        "setAutoRenewPeriod",
        "setTokenMemo",
        "setFeeScheduleKey",
        "setPauseKey",
        "setMetadataKey",
        "setMetadata",
        "setKeyVerificationMode",
    ]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TokenUpdateTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("TokenUpdateOperation (via TokenService)", () => {
    let context: IHieroContext;
    let service: TokenService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new TokenService(context);
    });

    it("submits an update with only tokenId and skips all optional setters", async () => {
        await service.updateToken({ tokenId: "0.0.500" });

        const tx = vi.mocked(TokenUpdateTransaction).mock.results[0].value;

        expect(tx.setTokenId).toHaveBeenCalledWith("0.0.500");
        expect(tx.setTokenName).not.toHaveBeenCalled();
        expect(tx.setTokenSymbol).not.toHaveBeenCalled();
        expect(tx.setTreasuryAccountId).not.toHaveBeenCalled();
        expect(tx.setAdminKey).not.toHaveBeenCalled();
        expect(tx.setKycKey).not.toHaveBeenCalled();
        expect(tx.setFreezeKey).not.toHaveBeenCalled();
        expect(tx.setWipeKey).not.toHaveBeenCalled();
        expect(tx.setSupplyKey).not.toHaveBeenCalled();
        expect(tx.setAutoRenewAccountId).not.toHaveBeenCalled();
        expect(tx.setExpirationTime).not.toHaveBeenCalled();
        expect(tx.setAutoRenewPeriod).not.toHaveBeenCalled();
        expect(tx.setTokenMemo).not.toHaveBeenCalled();
        expect(tx.setFeeScheduleKey).not.toHaveBeenCalled();
        expect(tx.setPauseKey).not.toHaveBeenCalled();
        expect(tx.setMetadataKey).not.toHaveBeenCalled();
        expect(tx.setMetadata).not.toHaveBeenCalled();
        expect(tx.setKeyVerificationMode).not.toHaveBeenCalled();
        expect(tx.execute).toHaveBeenCalledWith(context.client);
    });

    it("applies all provided update fields", async () => {
        const adminKey = PrivateKey.generateED25519().publicKey;
        const kycKey = PrivateKey.generateED25519().publicKey;
        const freezeKey = PrivateKey.generateED25519().publicKey;
        const wipeKey = PrivateKey.generateED25519().publicKey;
        const supplyKey = PrivateKey.generateED25519().publicKey;
        const feeScheduleKey = PrivateKey.generateED25519().publicKey;
        const pauseKey = PrivateKey.generateED25519().publicKey;
        const metadataKey = PrivateKey.generateED25519().publicKey;
        const expirationTime = new Date();
        const metadata = new Uint8Array([1, 2, 3]);

        await service.updateToken({
            tokenId: "0.0.500",
            tokenName: "Renamed",
            tokenSymbol: "RNM",
            treasuryAccountId: "0.0.999",
            adminKey,
            kycKey,
            freezeKey,
            wipeKey,
            supplyKey,
            autoRenewAccountId: "0.0.888",
            expirationTime,
            autoRenewPeriod: 7_776_000,
            tokenMemo: "updated memo",
            feeScheduleKey,
            pauseKey,
            metadataKey,
            metadata,
            keyVerificationMode: TokenKeyValidation.FullValidation,
        });

        const tx = vi.mocked(TokenUpdateTransaction).mock.results[0].value;

        expect(tx.setTokenId).toHaveBeenCalledWith("0.0.500");
        expect(tx.setTokenName).toHaveBeenCalledWith("Renamed");
        expect(tx.setTokenSymbol).toHaveBeenCalledWith("RNM");
        expect(tx.setTreasuryAccountId).toHaveBeenCalledWith("0.0.999");
        expect(tx.setAdminKey).toHaveBeenCalledWith(adminKey);
        expect(tx.setKycKey).toHaveBeenCalledWith(kycKey);
        expect(tx.setFreezeKey).toHaveBeenCalledWith(freezeKey);
        expect(tx.setWipeKey).toHaveBeenCalledWith(wipeKey);
        expect(tx.setSupplyKey).toHaveBeenCalledWith(supplyKey);
        expect(tx.setAutoRenewAccountId).toHaveBeenCalledWith("0.0.888");
        expect(tx.setExpirationTime).toHaveBeenCalledWith(expirationTime);
        expect(tx.setAutoRenewPeriod).toHaveBeenCalledWith(7_776_000);
        expect(tx.setTokenMemo).toHaveBeenCalledWith("updated memo");
        expect(tx.setFeeScheduleKey).toHaveBeenCalledWith(feeScheduleKey);
        expect(tx.setPauseKey).toHaveBeenCalledWith(pauseKey);
        expect(tx.setMetadataKey).toHaveBeenCalledWith(metadataKey);
        expect(tx.setMetadata).toHaveBeenCalledWith(metadata);
        expect(tx.setKeyVerificationMode).toHaveBeenCalledWith(
            TokenKeyValidation.FullValidation,
        );
    });

    it("applies base TransactionOptions and additionalSigners", async () => {
        const adminSigner = PrivateKey.generateED25519();

        await service.updateToken({
            tokenId: "0.0.500",
            tokenName: "Renamed",
            transactionMemo: "update memo",
            transactionValidDuration: 60,
            regenerateTransactionId: false,
            additionalSigners: [adminSigner],
        });

        const tx = vi.mocked(TokenUpdateTransaction).mock.results[0].value;

        expect(tx.setTransactionMemo).toHaveBeenCalledWith("update memo");
        expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(60);
        expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
        expect(tx.sign).toHaveBeenCalledWith(adminSigner);
    });

    it("wraps the update in a ScheduleCreateTransaction", async () => {
        const result = await service.scheduleUpdateToken(
            {
                tokenId: "0.0.500",
                tokenName: "Renamed",
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

    it("throws when tokenId is missing", async () => {
        await expect(
            service.updateToken({
                tokenId: undefined as unknown as string,
            }),
        ).rejects.toThrow(/tokenId is required/);
    });

    it("throws when tokenName exceeds 100 bytes", async () => {
        await expect(
            service.updateToken({
                tokenId: "0.0.500",
                tokenName: "a".repeat(101),
            }),
        ).rejects.toThrow(/tokenName exceeds 100 bytes/);
    });
});
