import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    AccountId,
    Hbar,
    NftId,
    PrivateKey,
    TokenDissociateTransaction,
    TokenId,
    TokenRejectTransaction,
} from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");

    return {
        reject: buildMockTxBundle(["setOwnerId", "setTokenIds", "setNftIds"]),
        dissociate: buildMockTxBundle(["setAccountId", "setTokenIds"]),
    };
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TokenRejectTransaction: vi.fn(function () {
            return mocks.reject.tx;
        }),
        TokenDissociateTransaction: vi.fn(function () {
            return mocks.dissociate.tx;
        }),
    };
});

describe("TokenRejectOperation (via TokenService)", () => {
    let context: IHieroContext;
    let service: TokenService;

    beforeEach(async () => {
        vi.clearAllMocks();
        const { reattachMockChain } =
            await import("../../../../utils/sdk-mocks.js");
        reattachMockChain(mocks.reject);
        reattachMockChain(mocks.dissociate);

        context = createMockContext();
        service = new TokenService(context);
    });

    it("submits reject then dissociate for fungible tokens", async () => {
        const tokenId = TokenId.fromString("0.0.500");

        await service.rejectTokens({
            ownerId: "0.0.700",
            fungibleTokenIds: [tokenId],
        });

        expect(TokenRejectTransaction).toHaveBeenCalledTimes(1);
        expect(TokenDissociateTransaction).toHaveBeenCalledTimes(1);

        expect(mocks.reject.tx.setOwnerId).toHaveBeenCalledWith(
            AccountId.fromString("0.0.700"),
        );
        expect(mocks.reject.tx.setTokenIds).toHaveBeenCalledWith([tokenId]);
        expect(mocks.reject.tx.setNftIds).not.toHaveBeenCalled();
        expect(mocks.reject.tx.execute).toHaveBeenCalledWith(context.client);

        expect(mocks.dissociate.tx.setAccountId).toHaveBeenCalledWith(
            "0.0.700",
        );
        expect(mocks.dissociate.tx.setTokenIds).toHaveBeenCalledWith([tokenId]);
    });

    it("submits reject then dissociate for NFT serials", async () => {
        const tokenId = TokenId.fromString("0.0.9999");
        const nftId = new NftId(tokenId, 3);

        await service.rejectTokens({
            ownerId: "0.0.700",
            nftIds: [nftId],
        });

        expect(mocks.reject.tx.setNftIds).toHaveBeenCalledWith([nftId]);
        expect(mocks.reject.tx.setTokenIds).not.toHaveBeenCalled();

        // Dissociation gets the NFT's parent token id (de-duplicated)
        expect(mocks.dissociate.tx.setTokenIds).toHaveBeenCalledTimes(1);
        const dissocArgs = mocks.dissociate.tx.setTokenIds.mock.calls[0][0];
        expect(dissocArgs.map((t: TokenId) => t.toString())).toEqual([
            "0.0.9999",
        ]);
    });

    it("dissociates the union of fungible + NFT parent ids, de-duplicated", async () => {
        const fungibleId = TokenId.fromString("0.0.1234");
        const nftCollectionId = TokenId.fromString("0.0.9999");
        const serial1 = new NftId(nftCollectionId, 1);
        const serial2 = new NftId(nftCollectionId, 2);

        await service.rejectTokens({
            ownerId: "0.0.700",
            fungibleTokenIds: [fungibleId],
            nftIds: [serial1, serial2],
        });

        expect(mocks.reject.tx.setTokenIds).toHaveBeenCalledWith([fungibleId]);
        expect(mocks.reject.tx.setNftIds).toHaveBeenCalledWith([
            serial1,
            serial2,
        ]);

        const dissocArgs = mocks.dissociate.tx.setTokenIds.mock.calls[0][0];
        expect(dissocArgs.map((t: TokenId) => t.toString())).toEqual([
            "0.0.1234",
            "0.0.9999",
        ]);
    });

    it("converts string ownerId to AccountId for the reject transaction", async () => {
        await service.rejectTokens({
            ownerId: "0.0.700",
            fungibleTokenIds: ["0.0.500"],
        });

        expect(mocks.reject.tx.setOwnerId).toHaveBeenCalledWith(
            AccountId.fromString("0.0.700"),
        );
    });

    it("accepts an AccountId instance for ownerId without conversion", async () => {
        const ownerId = AccountId.fromString("0.0.700");

        await service.rejectTokens({
            ownerId,
            fungibleTokenIds: ["0.0.500"],
        });

        expect(mocks.reject.tx.setOwnerId).toHaveBeenCalledWith(ownerId);
    });

    it("applies additionalSigners to both inner transactions", async () => {
        const ownerKey = PrivateKey.generateED25519();

        await service.rejectTokens({
            ownerId: "0.0.700",
            fungibleTokenIds: ["0.0.500"],
            additionalSigners: [ownerKey],
        });

        expect(mocks.reject.tx.sign).toHaveBeenCalledWith(ownerKey);
        expect(mocks.dissociate.tx.sign).toHaveBeenCalledWith(ownerKey);
    });

    it("applies base TransactionOptions (memo, fee) to both transactions", async () => {
        const fee = new Hbar(2);

        await service.rejectTokens({
            ownerId: "0.0.700",
            fungibleTokenIds: ["0.0.500"],
            transactionMemo: "reject test",
            maxTransactionFee: fee,
        });

        expect(mocks.reject.tx.setTransactionMemo).toHaveBeenCalledWith(
            "reject test",
        );
        expect(mocks.reject.tx.setMaxTransactionFee).toHaveBeenCalledWith(fee);
        expect(mocks.dissociate.tx.setTransactionMemo).toHaveBeenCalledWith(
            "reject test",
        );
        expect(mocks.dissociate.tx.setMaxTransactionFee).toHaveBeenCalledWith(
            fee,
        );
    });

    it("freezes both inner transactions with the context client", async () => {
        await service.rejectTokens({
            ownerId: "0.0.700",
            fungibleTokenIds: ["0.0.500"],
        });

        expect(mocks.reject.tx.freezeWith).toHaveBeenCalledWith(context.client);
        expect(mocks.dissociate.tx.freezeWith).toHaveBeenCalledWith(
            context.client,
        );
    });

    it("emits before/after events for both reject and dissociate", async () => {
        const beforeSpy = vi.spyOn(context, "emitBeforeTransaction");
        const afterSpy = vi.spyOn(context, "emitAfterTransaction");

        await service.rejectTokens({
            ownerId: "0.0.700",
            fungibleTokenIds: ["0.0.500"],
        });

        expect(beforeSpy).toHaveBeenCalledTimes(2);
        expect(beforeSpy).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                type: "TokenReject",
                serviceName: "TokenService",
                methodName: "rejectTokens",
            }),
        );
        expect(beforeSpy).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                type: "TokenDissociate",
                serviceName: "TokenService",
                methodName: "rejectTokens",
            }),
        );

        expect(afterSpy).toHaveBeenCalledTimes(2);
        expect(afterSpy).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                type: "TokenReject",
                status: "SUCCESS",
            }),
        );
        expect(afterSpy).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                type: "TokenDissociate",
                status: "SUCCESS",
            }),
        );
    });

    it("does not submit the dissociate when reject fails", async () => {
        const failure = new Error("reject failed");
        mocks.reject.tx.execute.mockRejectedValueOnce(failure);

        await expect(
            service.rejectTokens({
                ownerId: "0.0.700",
                fungibleTokenIds: ["0.0.500"],
            }),
        ).rejects.toThrow(/reject failed/);

        expect(mocks.dissociate.tx.execute).not.toHaveBeenCalled();
    });

    it("throws when ownerId is missing", async () => {
        await expect(
            service.rejectTokens({
                ownerId: undefined as unknown as string,
                fungibleTokenIds: ["0.0.500"],
            }),
        ).rejects.toThrow(/ownerId is required/i);
    });

    it("throws when ownerId is empty", async () => {
        await expect(
            service.rejectTokens({
                ownerId: "",
                fungibleTokenIds: ["0.0.500"],
            }),
        ).rejects.toThrow(/ownerId cannot be empty/i);
    });

    it("throws when neither fungibleTokenIds nor nftIds is supplied", async () => {
        await expect(
            service.rejectTokens({
                ownerId: "0.0.700",
            }),
        ).rejects.toThrow(/at least one fungibleTokenId or nftId/i);
    });

    it("throws when both fungibleTokenIds and nftIds are empty arrays", async () => {
        await expect(
            service.rejectTokens({
                ownerId: "0.0.700",
                fungibleTokenIds: [],
                nftIds: [],
            }),
        ).rejects.toThrow(/at least one fungibleTokenId or nftId/i);
    });

    it("throws when fungibleTokenIds contains an empty string", async () => {
        await expect(
            service.rejectTokens({
                ownerId: "0.0.700",
                fungibleTokenIds: [""],
            }),
        ).rejects.toThrow(/fungibleTokenIds entries cannot be empty/i);
    });

    it("throws when nftIds contains a null entry", async () => {
        await expect(
            service.rejectTokens({
                ownerId: "0.0.700",
                nftIds: [null as unknown as NftId],
            }),
        ).rejects.toThrow(/nftIds entries cannot be null/i);
    });
});
