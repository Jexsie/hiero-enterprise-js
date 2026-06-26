import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    AccountId,
    NftId,
    PendingAirdropId,
    PrivateKey,
    TokenCancelAirdropTransaction,
    TokenId,
} from "@hiero-ledger/sdk";
import { TokenService } from "../../../../../src/services/token/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle(["setPendingAirdropIds"]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TokenCancelAirdropTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("TokenCancelAirdropOperation (via TokenService)", () => {
    let context: IHieroContext;
    let service: TokenService;

    const fungiblePending = new PendingAirdropId({
        senderId: AccountId.fromString("0.0.700"),
        receiverId: AccountId.fromString("0.0.800"),
        tokenId: TokenId.fromString("0.0.500"),
    });

    const nftPending = new PendingAirdropId({
        senderId: AccountId.fromString("0.0.700"),
        receiverId: AccountId.fromString("0.0.800"),
        nftId: new NftId(TokenId.fromString("0.0.600"), 1),
    });

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new TokenService(context);
    });

    it("cancels a single fungible pending airdrop", async () => {
        await service.cancelAirdrop({
            pendingAirdropIds: [fungiblePending],
        });

        const tx = vi.mocked(TokenCancelAirdropTransaction).mock.results[0]
            .value;
        const calls = tx.setPendingAirdropIds.mock.calls as Array<
            [PendingAirdropId[]]
        >;

        expect(calls).toHaveLength(1);
        expect(calls[0][0]).toEqual([fungiblePending]);

        expect(tx.execute).toHaveBeenCalledWith(context.client);
    });

    it("cancels a single NFT pending airdrop", async () => {
        await service.cancelAirdrop({
            pendingAirdropIds: [nftPending],
        });

        const tx = vi.mocked(TokenCancelAirdropTransaction).mock.results[0]
            .value;
        const calls = tx.setPendingAirdropIds.mock.calls as Array<
            [PendingAirdropId[]]
        >;

        expect(calls[0][0]).toEqual([nftPending]);
    });

    it("batches fungible and NFT pending airdrops in a single cancel transaction", async () => {
        await service.cancelAirdrop({
            pendingAirdropIds: [fungiblePending, nftPending],
        });

        const tx = vi.mocked(TokenCancelAirdropTransaction).mock.results[0]
            .value;
        const calls = tx.setPendingAirdropIds.mock.calls as Array<
            [PendingAirdropId[]]
        >;

        expect(calls).toHaveLength(1);
        expect(calls[0][0]).toEqual([fungiblePending, nftPending]);
    });

    it("applies base TransactionOptions and additionalSigners", async () => {
        const signer = PrivateKey.generateED25519();

        await service.cancelAirdrop({
            pendingAirdropIds: [fungiblePending],
            transactionMemo: "cancel test",
            regenerateTransactionId: false,
            additionalSigners: [signer],
        });

        const tx = vi.mocked(TokenCancelAirdropTransaction).mock.results[0]
            .value;
        expect(tx.setTransactionMemo).toHaveBeenCalledWith("cancel test");
        expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        expect(tx.sign).toHaveBeenCalledWith(signer);
        expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
        expect(tx.execute).toHaveBeenCalledWith(context.client);
    });

    it("normalises and rethrows validation errors before touching the SDK", async () => {
        await expect(
            service.cancelAirdrop({
                pendingAirdropIds: [],
            }),
        ).rejects.toThrow(/pendingAirdropIds must not be empty/);

        expect(vi.mocked(TokenCancelAirdropTransaction)).not.toHaveBeenCalled();
    });

    it("rejects null entries inside pendingAirdropIds", async () => {
        await expect(
            service.cancelAirdrop({
                pendingAirdropIds: [
                    fungiblePending,
                    null as unknown as PendingAirdropId,
                ],
            }),
        ).rejects.toThrow(/pendingAirdropIds\[1\] is required/);

        expect(vi.mocked(TokenCancelAirdropTransaction)).not.toHaveBeenCalled();
    });
});
