/**
 * Airdrop Fungible Token — distribute fungible tokens from a sender to a
 * receiver without requiring up-front association by the receiver.
 *
 * Demonstrates the immediate `airdropFungibleToken` path exposed by
 * TokenService. Behaviour depends on the receiver's association state:
 *
 * - Already associated: tokens are credited immediately.
 * - Has free auto-association slots: token is auto-associated and credited.
 * - Receiver-sig-required or no auto-association slots: a "Pending
 *   Airdrop" is created that the receiver can later claim.
 *
 * The sample associates the receiver up-front, producing an immediate
 * credit. The sender account's key signs via `additionalSigners`.
 *
 * Note: `TokenAirdrop` is not whitelisted for scheduling on the network,
 * so no scheduled variant is shown.
 *
 * Run: pnpm tsx src/token/airdrop-fungible-token.ts
 */

import {
    AccountService,
    AccountType,
    HieroContext,
    PrivateKey,
    TokenService,
} from "@hiero-enterprise/core";
import { getED25519Config } from "../env.js";

async function airdropFungibleToken(
    accountService: AccountService,
    tokenService: TokenService,
) {
    console.log("=== Airdrop Fungible Token ===\n");

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 5,
        memo: "airdrop sender",
    });

    const receiverKey = PrivateKey.generateED25519();
    const receiver = await accountService.createAccount({
        publicKey: receiverKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: 2,
        memo: "airdrop receiver",
    });

    const tokenId = await tokenService.createFungibleToken({
        tokenName: "Airdrop Demo Token",
        tokenSymbol: "AIR",
        decimals: 0,
        initialSupply: 100,
        treasuryAccountId: owner.accountId,
        supplyKey: ownerKey.publicKey,
        additionalSigners: [ownerKey],
    });

    await tokenService.associateToken({
        accountId: receiver.accountId,
        tokenId,
        additionalSigners: [receiverKey],
    });

    await tokenService.airdropFungibleToken({
        tokenId,
        senderAccountId: owner.accountId,
        receiverAccountId: receiver.accountId,
        amount: 10,
        additionalSigners: [ownerKey],
    });

    console.log("Sender account:", owner.accountId);
    console.log("Receiver account:", receiver.accountId);
    console.log("Airdropped token:", tokenId);
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);
    const tokenService = new TokenService(context);

    try {
        await airdropFungibleToken(accountService, tokenService);
        console.log("All token airdrop scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("airdrop-fungible-token sample failed:", error);
    process.exitCode = 1;
});
