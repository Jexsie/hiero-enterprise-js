import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    AccountId,
    NftId,
    PendingAirdropId,
    PrivateKey,
    TokenClaimAirdropTransaction,
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
        TokenClaimAirdropTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("TokenClaimAirdropOperation (via TokenService)", () => {
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

    it("claims a single fungible pending airdrop", async () => {
        await service.claimAirdrop({
            pendingAirdropIds: [fungiblePending],
        });

        const tx = vi.mocked(TokenClaimAirdropTransaction).mock.results[0]
            .value;
        const calls = tx.setPendingAirdropIds.mock.calls as Array<
            [PendingAirdropId[]]
        >;

        expect(calls).toHaveLength(1);
        expect(calls[0][0]).toEqual([fungiblePending]);

        expect(tx.execute).toHaveBeenCalledWith(context.client);
    });

    it("claims a single NFT pending airdrop", async () => {
        await service.claimAirdrop({
            pendingAirdropIds: [nftPending],
        });

        const tx = vi.mocked(TokenClaimAirdropTransaction).mock.results[0]
            .value;
        const calls = tx.setPendingAirdropIds.mock.calls as Array<
            [PendingAirdropId[]]
        >;

        expect(calls[0][0]).toEqual([nftPending]);
    });

    it("batches fungible and NFT pending airdrops in a single claim transaction", async () => {
        await service.claimAirdrop({
            pendingAirdropIds: [fungiblePending, nftPending],
        });

        const tx = vi.mocked(TokenClaimAirdropTransaction).mock.results[0]
            .value;
        const calls = tx.setPendingAirdropIds.mock.calls as Array<
            [PendingAirdropId[]]
        >;

        expect(calls).toHaveLength(1);
        expect(calls[0][0]).toEqual([fungiblePending, nftPending]);
    });

    it("applies base TransactionOptions and additionalSigners", async () => {
        const signer = PrivateKey.generateED25519();

        await service.claimAirdrop({
            pendingAirdropIds: [fungiblePending],
            transactionMemo: "claim test",
            regenerateTransactionId: false,
            additionalSigners: [signer],
        });

        const tx = vi.mocked(TokenClaimAirdropTransaction).mock.results[0]
            .value;
        expect(tx.setTransactionMemo).toHaveBeenCalledWith("claim test");
        expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        expect(tx.sign).toHaveBeenCalledWith(signer);
        expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
        expect(tx.execute).toHaveBeenCalledWith(context.client);
    });

    it("normalises and rethrows validation errors before touching the SDK", async () => {
        await expect(
            service.claimAirdrop({
                pendingAirdropIds: [],
            }),
        ).rejects.toThrow(/pendingAirdropIds must not be empty/);

        expect(vi.mocked(TokenClaimAirdropTransaction)).not.toHaveBeenCalled();
    });

    it("rejects null entries inside pendingAirdropIds", async () => {
        await expect(
            service.claimAirdrop({
                pendingAirdropIds: [
                    fungiblePending,
                    null as unknown as PendingAirdropId,
                ],
            }),
        ).rejects.toThrow(/pendingAirdropIds\[1\] is required/);

        expect(vi.mocked(TokenClaimAirdropTransaction)).not.toHaveBeenCalled();
    });
});
