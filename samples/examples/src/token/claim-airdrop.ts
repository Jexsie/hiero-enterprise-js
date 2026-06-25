/**
 * Claim Airdrop — finalise previously-created pending airdrops (fungible
 * and / or NFT) by passing pre-built `PendingAirdropId` references.
 *
 * Demonstrates the unified `claimAirdrop` API exposed by `TokenService`.
 * One call accepts a mixed batch of fungible and NFT pending airdrop IDs
 * — the underlying transaction handles either kind uniformly.
 *
 * When the network cannot credit a receiver immediately (no association
 * and no available auto-association slot, or receiver-sig-required), the
 * airdrop is parked as a pending entry. Claiming finalises the transfer:
 * the assets move from the sender's pending escrow into the receiver's
 * account.
 *
 * `PendingAirdropId` instances can be constructed directly when the
 * caller already knows `(senderId, receiverId, tokenId | nftId)`, or
 * discovered via the mirror node
 * (`/api/v1/accounts/{id}/airdrops/pending`) for receivers whose
 * outstanding pending airdrops are not known up-front.
 *
 * This sample walks through three scenarios:
 *  1. Single pending fungible airdrop → receiver claims → balance credited.
 *  2. Single pending NFT airdrop → receiver claims → NFT held.
 *  3. Mixed batch — one fungible + one NFT pending airdrop, claimed
 *     atomically in a single transaction.
 *
 * Every distinct receiver must sign — supplied via `additionalSigners`.
 * The operator pays the transaction fee.
 *
 * Note: `TokenClaimAirdrop` is not whitelisted for scheduling on the
 * network, so no scheduled variant is shown.
 *
 * Run: pnpm tsx src/token/claim-airdrop.ts
 */

import {
    AccountService,
    AccountType,
    HieroContext,
    NftId,
    PendingAirdropId,
    PrivateKey,
    TokenId,
    TokenService,
    type Balance,
} from "@hiero-enterprise/core";
import { getED25519Config } from "../env.js";

function tokenBalanceFor(
    balance: Balance,
    tokenId: string,
): string | undefined {
    return balance.tokens.find((t) => t.tokenId === tokenId)?.balance;
}

async function createKeyedAccount(
    accountService: AccountService,
    initialBalance: number,
    memo: string,
): Promise<{ accountId: string; key: PrivateKey }> {
    const key = PrivateKey.generateED25519();
    const account = await accountService.createAccount({
        publicKey: key.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance,
        memo,
    });
    return { accountId: account.accountId, key };
}

async function claimPendingFungibleAirdrop(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Scenario 1: Claim a pending fungible airdrop ===\n");

    const owner = await createKeyedAccount(accountService, 5, "airdrop owner");
    const receiver = await createKeyedAccount(
        accountService,
        2,
        "claim receiver",
    );

    const tokenId = await tokenService.createFungibleToken({
        tokenName: "Claim Fungible Demo Token",
        tokenSymbol: "CFDT",
        decimals: 0,
        initialSupply: 100,
        treasuryAccountId: owner.accountId,
        supplyKey: owner.key.publicKey,
        additionalSigners: [owner.key],
    });

    // Receiver is NOT associated, so this is parked as a pending airdrop.
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

    const beforeClaim = await accountService.getAccountBalance(
        receiver.accountId,
    );
    console.log("Token:", tokenId);
    console.log(
        "  Receiver balance before claim:",
        tokenBalanceFor(beforeClaim, tokenId) ??
            "<no relationship — pending airdrop>",
    );

    // The receiver finalises the pending airdrop. Their key must sign.
    await tokenService.claimAirdrop({
        pendingAirdropIds: [
            new PendingAirdropId({
                senderId: owner.accountId,
                receiverId: receiver.accountId,
                tokenId,
            }),
        ],
        additionalSigners: [receiver.key],
    });

    const afterClaim = await accountService.getAccountBalance(
        receiver.accountId,
    );
    console.log(
        "  Receiver balance after claim:",
        tokenBalanceFor(afterClaim, tokenId) ?? "0",
    );
    console.log();
}

async function claimPendingNftAirdrop(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Scenario 2: Claim a pending NFT airdrop ===\n");

    const owner = await createKeyedAccount(accountService, 5, "nft owner");
    const receiver = await createKeyedAccount(
        accountService,
        2,
        "claim nft receiver",
    );

    const tokenId = await tokenService.createNft({
        tokenName: "Claim NFT Demo Collection",
        tokenSymbol: "CNDC",
        treasuryAccountId: owner.accountId,
        supplyKey: owner.key.publicKey,
        additionalSigners: [owner.key],
    });

    await tokenService.mintToken({
        tokenId,
        metadata: [Buffer.from("claim-nft-1")],
        additionalSigners: [owner.key],
    });

    // Receiver is NOT associated, so this is parked as a pending NFT airdrop.
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

    const beforeClaim = await accountService.getAccountBalance(
        receiver.accountId,
    );
    console.log("Collection:", tokenId);
    console.log(
        "  Receiver NFT count before claim:",
        tokenBalanceFor(beforeClaim, tokenId) ??
            "<no relationship — pending airdrop>",
    );

    // The receiver finalises the pending NFT airdrop. Their key must sign.
    await tokenService.claimAirdrop({
        pendingAirdropIds: [
            new PendingAirdropId({
                senderId: owner.accountId,
                receiverId: receiver.accountId,
                nftId: new NftId(TokenId.fromString(tokenId), 1),
            }),
        ],
        additionalSigners: [receiver.key],
    });

    const afterClaim = await accountService.getAccountBalance(
        receiver.accountId,
    );
    console.log(
        "  Receiver NFT count after claim:",
        tokenBalanceFor(afterClaim, tokenId) ?? "0",
    );
    console.log();
}

async function claimMixedBatch(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Scenario 3: Claim a mixed batch (fungible + NFT) ===\n");

    const owner = await createKeyedAccount(accountService, 5, "mixed owner");
    const receiver = await createKeyedAccount(
        accountService,
        2,
        "mixed claim receiver",
    );

    const fungibleTokenId = await tokenService.createFungibleToken({
        tokenName: "Claim Batch Fungible Demo",
        tokenSymbol: "CBFD",
        decimals: 0,
        initialSupply: 100,
        treasuryAccountId: owner.accountId,
        supplyKey: owner.key.publicKey,
        additionalSigners: [owner.key],
    });

    const nftTokenId = await tokenService.createNft({
        tokenName: "Claim Batch NFT Demo",
        tokenSymbol: "CBND",
        treasuryAccountId: owner.accountId,
        supplyKey: owner.key.publicKey,
        additionalSigners: [owner.key],
    });

    await tokenService.mintToken({
        tokenId: nftTokenId,
        metadata: [Buffer.from("batch-claim-nft-1")],
        additionalSigners: [owner.key],
    });

    // Both airdrops are parked as pending entries (receiver is not associated).
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

    // A single claim transaction finalises both pending airdrops atomically.
    await tokenService.claimAirdrop({
        pendingAirdropIds: [
            new PendingAirdropId({
                senderId: owner.accountId,
                receiverId: receiver.accountId,
                tokenId: fungibleTokenId,
            }),
            new PendingAirdropId({
                senderId: owner.accountId,
                receiverId: receiver.accountId,
                nftId: new NftId(TokenId.fromString(nftTokenId), 1),
            }),
        ],
        additionalSigners: [receiver.key],
    });

    const afterClaim = await accountService.getAccountBalance(
        receiver.accountId,
    );

    console.log("Fungible token:", fungibleTokenId);
    console.log(
        "  Receiver balance after claim:",
        tokenBalanceFor(afterClaim, fungibleTokenId) ?? "0",
    );
    console.log("NFT collection:", nftTokenId);
    console.log(
        "  Receiver NFT count after claim:",
        tokenBalanceFor(afterClaim, nftTokenId) ?? "0",
    );
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);

    try {
        await claimPendingFungibleAirdrop(accountService, tokenService);
        await claimPendingNftAirdrop(accountService, tokenService);
        await claimMixedBatch(accountService, tokenService);
        console.log("All claim airdrop scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("claim-airdrop sample failed:", error);
    process.exitCode = 1;
});
