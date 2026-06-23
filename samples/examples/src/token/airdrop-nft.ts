/**
 * Airdrop NFTs — distribute NFT serials from one or more senders to one
 * or more receivers in a single transaction.
 *
 * Demonstrates the batched `airdropNft` API exposed by `TokenService`.
 * Behaviour per receiver depends on its association state:
 *
 * - Already associated: the NFT is credited immediately.
 * - Has free auto-association slots: the collection is auto-associated and
 *   the NFT is credited.
 * - Receiver-sig-required or no auto-association slots: a "Pending
 *   Airdrop" is created that the receiver can later claim.
 *
 * This sample walks through three scenarios:
 *  1. Multi-receiver batch where every receiver is pre-associated —
 *     each receives one NFT immediately.
 *  2. Unassociated receiver — produces a pending airdrop, so the account
 *     balance query still reports no token relationship.
 *  3. Mixed batch — one associated and one unassociated receiver in the
 *     same transaction, with mixed outcomes.
 *
 * Every distinct sender's key must sign — supplied via `additionalSigners`.
 *
 * Note: `TokenAirdrop` is not whitelisted for scheduling on the network,
 * so no scheduled variant is shown.
 *
 * Run: pnpm tsx src/token/airdrop-nft.ts
 */

import {
    AccountService,
    AccountType,
    HieroContext,
    PrivateKey,
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

async function multiReceiverImmediateCredit(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Scenario 1: Multi-receiver NFT airdrop ===\n");

    const owner = await createKeyedAccount(
        accountService,
        5,
        "nft airdrop owner",
    );
    const receiver1 = await createKeyedAccount(accountService, 2, "receiver 1");
    const receiver2 = await createKeyedAccount(accountService, 2, "receiver 2");
    const receiver3 = await createKeyedAccount(accountService, 2, "receiver 3");

    const tokenId = await tokenService.createNft({
        tokenName: "Multi NFT Airdrop Demo",
        tokenSymbol: "MNAD",
        treasuryAccountId: owner.accountId,
        supplyKey: owner.key.publicKey,
        additionalSigners: [owner.key],
    });

    await tokenService.mintToken({
        tokenId,
        metadata: [
            Buffer.from("nft-1"),
            Buffer.from("nft-2"),
            Buffer.from("nft-3"),
        ],
        additionalSigners: [owner.key],
    });

    for (const r of [receiver1, receiver2, receiver3]) {
        await tokenService.associateToken({
            accountId: r.accountId,
            tokenId,
            additionalSigners: [r.key],
        });
    }

    await tokenService.airdropNft({
        airdrops: [
            {
                tokenId,
                serial: 1,
                senderAccountId: owner.accountId,
                receiverAccountId: receiver1.accountId,
            },
            {
                tokenId,
                serial: 2,
                senderAccountId: owner.accountId,
                receiverAccountId: receiver2.accountId,
            },
            {
                tokenId,
                serial: 3,
                senderAccountId: owner.accountId,
                receiverAccountId: receiver3.accountId,
            },
        ],
        additionalSigners: [owner.key],
    });

    console.log("Collection:", tokenId);
    for (const r of [receiver1, receiver2, receiver3]) {
        const balance = await accountService.getAccountBalance(r.accountId);
        console.log(
            `  ${r.accountId} NFTs held:`,
            tokenBalanceFor(balance, tokenId) ?? "0",
        );
    }
    console.log();
}

async function pendingAirdropToUnassociatedReceiver(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log(
        "=== Scenario 2: Pending NFT airdrop (unassociated receiver) ===\n",
    );

    const owner = await createKeyedAccount(
        accountService,
        5,
        "nft airdrop owner",
    );
    const receiver = await createKeyedAccount(
        accountService,
        2,
        "pending nft receiver",
    );

    const tokenId = await tokenService.createNft({
        tokenName: "Pending NFT Airdrop Demo",
        tokenSymbol: "PNAD",
        treasuryAccountId: owner.accountId,
        supplyKey: owner.key.publicKey,
        additionalSigners: [owner.key],
    });

    await tokenService.mintToken({
        tokenId,
        metadata: [Buffer.from("pending-nft")],
        additionalSigners: [owner.key],
    });

    // Receiver is NOT associated and has no auto-association slots, so the
    // network records a Pending Airdrop the receiver can later claim.
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

    const balance = await accountService.getAccountBalance(receiver.accountId);
    const credited = tokenBalanceFor(balance, tokenId);

    console.log("Collection:", tokenId);
    console.log("Receiver account:", receiver.accountId);
    console.log(
        "Receiver NFTs held:",
        credited ?? "<no relationship — pending airdrop>",
    );
    console.log(
        "(The receiver must claim the pending airdrop to take ownership of serial 1.)",
    );
    console.log();
}

async function mixedBatch(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log(
        "=== Scenario 3: Mixed batch — one associated + one pending ===\n",
    );

    const owner = await createKeyedAccount(
        accountService,
        5,
        "nft airdrop owner",
    );
    const associated = await createKeyedAccount(
        accountService,
        2,
        "associated receiver",
    );
    const unassociated = await createKeyedAccount(
        accountService,
        2,
        "unassociated receiver",
    );

    const tokenId = await tokenService.createNft({
        tokenName: "Mixed NFT Airdrop Demo",
        tokenSymbol: "MIXNAD",
        treasuryAccountId: owner.accountId,
        supplyKey: owner.key.publicKey,
        additionalSigners: [owner.key],
    });

    await tokenService.mintToken({
        tokenId,
        metadata: [Buffer.from("mix-1"), Buffer.from("mix-2")],
        additionalSigners: [owner.key],
    });

    await tokenService.associateToken({
        accountId: associated.accountId,
        tokenId,
        additionalSigners: [associated.key],
    });

    await tokenService.airdropNft({
        airdrops: [
            {
                tokenId,
                serial: 1,
                senderAccountId: owner.accountId,
                receiverAccountId: associated.accountId,
            },
            {
                tokenId,
                serial: 2,
                senderAccountId: owner.accountId,
                receiverAccountId: unassociated.accountId,
            },
        ],
        additionalSigners: [owner.key],
    });

    const associatedBalance = await accountService.getAccountBalance(
        associated.accountId,
    );
    const unassociatedBalance = await accountService.getAccountBalance(
        unassociated.accountId,
    );

    console.log("Collection:", tokenId);
    console.log(
        "  Associated receiver",
        associated.accountId,
        "NFTs held:",
        tokenBalanceFor(associatedBalance, tokenId) ?? "0",
    );
    console.log(
        "  Unassociated receiver",
        unassociated.accountId,
        "NFTs held:",
        tokenBalanceFor(unassociatedBalance, tokenId) ??
            "<no relationship — pending airdrop>",
    );
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);

    try {
        await multiReceiverImmediateCredit(accountService, tokenService);
        await pendingAirdropToUnassociatedReceiver(
            accountService,
            tokenService,
        );
        await mixedBatch(accountService, tokenService);
        console.log("All NFT airdrop scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("airdrop-nft sample failed:", error);
    process.exitCode = 1;
});
