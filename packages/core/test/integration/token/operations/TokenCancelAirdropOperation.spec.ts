import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import { waitForMirrorNodeRecord } from "../../../utils/mirror-node.js";
import {
    createTestAccount,
    type TestAccount,
} from "../../../utils/integration-fixtures.js";
import {
    AccountService,
    TokenService,
} from "../../../../src/services/index.js";
import { NftId, PendingAirdropId, TokenId } from "@hiero-ledger/sdk";

function tokenBalanceFor(
    balance: { tokens: { tokenId: string; balance: string }[] },
    tokenId: string,
): string | undefined {
    return balance.tokens.find((t) => t.tokenId === tokenId)?.balance;
}

describe("TokenService cancel airdrop operations [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let owner: TestAccount;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        owner = await createTestAccount(accountService, 10);
    });

    it("cancels a pending fungible airdrop so the receiver never receives the token", async () => {
        const receiver = await createTestAccount(accountService, 2);

        const tokenId = await tokenService.createFungibleToken({
            tokenName: "Cancel Fungible Integration",
            tokenSymbol: "CFI",
            decimals: 0,
            initialSupply: 100,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        // Receiver is not associated and has no auto-association slots,
        // so this becomes a pending airdrop held in escrow.
        await tokenService.airdropFungibleToken({
            airdrops: [
                {
                    tokenId,
                    senderAccountId: owner.accountId,
                    receiverAccountId: receiver.accountId,
                    amount: 25,
                },
            ],
            additionalSigners: [owner.key],
        });

        await waitForMirrorNodeRecord();

        // Sanity: the pending airdrop has not credited the receiver.
        const beforeCancel = await accountService.getAccountBalance(
            receiver.accountId,
        );
        expect(tokenBalanceFor(beforeCancel, tokenId)).toBeUndefined();

        // The sender (owner) cancels the pending airdrop.
        await tokenService.cancelAirdrop({
            pendingAirdropIds: [
                new PendingAirdropId({
                    senderId: owner.accountId,
                    receiverId: receiver.accountId,
                    tokenId: TokenId.fromString(tokenId),
                }),
            ],
            additionalSigners: [owner.key],
        });

        await waitForMirrorNodeRecord();

        // The receiver was never credited (cancel removed the pending entry).
        const afterCancel = await accountService.getAccountBalance(
            receiver.accountId,
        );
        expect(tokenBalanceFor(afterCancel, tokenId)).toBeUndefined();

        // The owner (treasury) still holds the full supply: the escrow was
        // released back to the sender's available balance.
        const ownerBalance = await accountService.getAccountBalance(
            owner.accountId,
        );
        expect(tokenBalanceFor(ownerBalance, tokenId)).toBe("100");
    });

    it("cancels a pending NFT airdrop so the serial stays with the treasury", async () => {
        const receiver = await createTestAccount(accountService, 2);

        const tokenId = await tokenService.createNft({
            tokenName: "Cancel NFT Integration",
            tokenSymbol: "CNI",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.mintToken({
            tokenId,
            metadata: [Buffer.from("cancel-nft-1")],
            additionalSigners: [owner.key],
        });

        await tokenService.airdropNft({
            airdrops: [
                {
                    tokenId,
                    serial: 1,
                    senderAccountId: owner.accountId,
                    receiverAccountId: receiver.accountId,
                },
            ],
            additionalSigners: [owner.key],
        });

        await waitForMirrorNodeRecord();

        const beforeCancel = await accountService.getAccountBalance(
            receiver.accountId,
        );
        expect(tokenBalanceFor(beforeCancel, tokenId)).toBeUndefined();

        await tokenService.cancelAirdrop({
            pendingAirdropIds: [
                new PendingAirdropId({
                    senderId: owner.accountId,
                    receiverId: receiver.accountId,
                    nftId: new NftId(TokenId.fromString(tokenId), 1),
                }),
            ],
            additionalSigners: [owner.key],
        });

        await waitForMirrorNodeRecord();

        const afterCancel = await accountService.getAccountBalance(
            receiver.accountId,
        );
        expect(tokenBalanceFor(afterCancel, tokenId)).toBeUndefined();

        // The owner (treasury) still holds the minted serial.
        const ownerBalance = await accountService.getAccountBalance(
            owner.accountId,
        );
        expect(tokenBalanceFor(ownerBalance, tokenId)).toBe("1");
    });

    it("cancels a mixed batch of pending fungible and NFT airdrops in one transaction", async () => {
        const receiver = await createTestAccount(accountService, 2);

        const fungibleTokenId = await tokenService.createFungibleToken({
            tokenName: "Cancel Batch Fungible Integration",
            tokenSymbol: "CBFI",
            decimals: 0,
            initialSupply: 100,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        const nftTokenId = await tokenService.createNft({
            tokenName: "Cancel Batch NFT Integration",
            tokenSymbol: "CBNI",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.mintToken({
            tokenId: nftTokenId,
            metadata: [Buffer.from("batch-cancel-nft-1")],
            additionalSigners: [owner.key],
        });

        await tokenService.airdropFungibleToken({
            airdrops: [
                {
                    tokenId: fungibleTokenId,
                    senderAccountId: owner.accountId,
                    receiverAccountId: receiver.accountId,
                    amount: 12,
                },
            ],
            additionalSigners: [owner.key],
        });

        await tokenService.airdropNft({
            airdrops: [
                {
                    tokenId: nftTokenId,
                    serial: 1,
                    senderAccountId: owner.accountId,
                    receiverAccountId: receiver.accountId,
                },
            ],
            additionalSigners: [owner.key],
        });

        await waitForMirrorNodeRecord();

        // One cancel transaction recalls both pending airdrops atomically.
        await tokenService.cancelAirdrop({
            pendingAirdropIds: [
                new PendingAirdropId({
                    senderId: owner.accountId,
                    receiverId: receiver.accountId,
                    tokenId: TokenId.fromString(fungibleTokenId),
                }),
                new PendingAirdropId({
                    senderId: owner.accountId,
                    receiverId: receiver.accountId,
                    nftId: new NftId(TokenId.fromString(nftTokenId), 1),
                }),
            ],
            additionalSigners: [owner.key],
        });

        await waitForMirrorNodeRecord();

        const receiverBalance = await accountService.getAccountBalance(
            receiver.accountId,
        );
        expect(
            tokenBalanceFor(receiverBalance, fungibleTokenId),
        ).toBeUndefined();
        expect(tokenBalanceFor(receiverBalance, nftTokenId)).toBeUndefined();

        const ownerBalance = await accountService.getAccountBalance(
            owner.accountId,
        );
        expect(tokenBalanceFor(ownerBalance, fungibleTokenId)).toBe("100");
        expect(tokenBalanceFor(ownerBalance, nftTokenId)).toBe("1");
    });
});
