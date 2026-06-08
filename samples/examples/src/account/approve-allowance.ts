/**
 * Approve Allowance — grant a spender permission to spend on the owner's behalf.
 *
 * Demonstrates:
 * 1. HBAR allowance — allow spender to spend up to N HBAR from owner
 * 2. Fungible token allowance — allow spender to transfer tokens from owner
 * 3. NFT allowance (specific serials) — allow spender to transfer specific NFTs
 * 4. NFT allowance (all serials) — blanket approval for all NFTs in a collection
 *
 * The owner's key must sign the transaction. Since the operator is not the owner,
 * we pass the owner's key via `additionalSigners`.
 *
 * Run: pnpm tsx src/account/approve-allowance.ts
 */

import {
    AccountService,
    AccountType,
    HieroContext,
    PrivateKey,
    Hbar,
} from "@hiero-enterprise/core";
import { getED25519Config } from "../env.js";

async function main() {
    const context = new HieroContext(getED25519Config());
    const accountService = new AccountService(context);

    // Setup: create owner and spender accounts

    const ownerKey = PrivateKey.generateED25519();
    const owner = await accountService.createAccount({
        publicKey: ownerKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(10),
        memo: "allowance owner",
    });
    console.log("Owner account:", owner.accountId);

    const spenderKey = PrivateKey.generateED25519();
    const spender = await accountService.createAccount({
        publicKey: spenderKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(1),
        memo: "allowance spender",
    });
    console.log("Spender account:", spender.accountId);

    // Approve HBAR allowance
    // The owner has to sign the transaction too

    await accountService.approveHbarAllowance({
        hbarAllowances: [
            {
                ownerAccountId: owner.accountId,
                spenderAccountId: spender.accountId,
                amount: 5, // up to 5 HBAR
            },
        ],
        additionalSigners: [ownerKey],
    });

    console.log("\n1. Approved HBAR allowance: spender can spend up to 5 HBAR");

    // Done

    console.log("\nAllowance approval complete.");
    context.client.close();
}

void main();
