import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    CustomFixedFee,
    Hbar,
    PrivateKey,
    TokenFeeScheduleUpdateTransaction,
} from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle(["setTokenId", "setCustomFees"]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TokenFeeScheduleUpdateTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("TokenFeeScheduleUpdateOperation (via TokenService)", () => {
    let context: IHieroContext;
    let service: TokenService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new TokenService(context);
    });

    it("updates a token's fee schedule with the supplied custom fees", async () => {
        const fee = new CustomFixedFee()
            .setAmount(1)
            .setFeeCollectorAccountId("0.0.1001");

        await service.updateTokenFeeSchedule({
            tokenId: "0.0.500",
            customFees: [fee],
        });

        const tx = vi.mocked(TokenFeeScheduleUpdateTransaction).mock.results[0]
            .value;
        expect(tx.setTokenId).toHaveBeenCalledWith("0.0.500");
        expect(tx.setCustomFees).toHaveBeenCalledWith([fee]);
        expect(tx.execute).toHaveBeenCalledWith(context.client);
    });

    it("clears all custom fees when an empty array is provided", async () => {
        await service.updateTokenFeeSchedule({
            tokenId: "0.0.500",
            customFees: [],
        });

        const tx = vi.mocked(TokenFeeScheduleUpdateTransaction).mock.results[0]
            .value;
        expect(tx.setTokenId).toHaveBeenCalledWith("0.0.500");
        expect(tx.setCustomFees).toHaveBeenCalledWith([]);
    });

    it("applies base TransactionOptions and additionalSigners", async () => {
        const signer = PrivateKey.generateED25519();
        const fee = new CustomFixedFee()
            .setHbarAmount(new Hbar(1))
            .setFeeCollectorAccountId("0.0.1001");

        await service.updateTokenFeeSchedule({
            tokenId: "0.0.500",
            customFees: [fee],
            transactionMemo: "fee schedule memo",
            transactionValidDuration: 60,
            regenerateTransactionId: false,
            additionalSigners: [signer],
        });

        const tx = vi.mocked(TokenFeeScheduleUpdateTransaction).mock.results[0]
            .value;
        expect(tx.setTransactionMemo).toHaveBeenCalledWith("fee schedule memo");
        expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(60);
        expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
        expect(tx.sign).toHaveBeenCalledWith(signer);
    });

    it("throws when tokenId is missing", async () => {
        await expect(
            service.updateTokenFeeSchedule({
                tokenId: undefined as unknown as string,
                customFees: [],
            }),
        ).rejects.toThrow(/tokenId is required/);
    });

    it("throws when tokenId is empty", async () => {
        await expect(
            service.updateTokenFeeSchedule({
                tokenId: "",
                customFees: [],
            }),
        ).rejects.toThrow(/tokenId cannot be empty/);
    });

    it("throws when customFees is missing", async () => {
        await expect(
            service.updateTokenFeeSchedule({
                tokenId: "0.0.500",
                customFees: undefined as unknown as never,
            }),
        ).rejects.toThrow(/customFees is required/);
    });
});
