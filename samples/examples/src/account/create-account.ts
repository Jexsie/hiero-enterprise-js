/**
 * Create Account — standard single-key pattern.
 *
 * Demonstrates the simplest account creation flow:
 * - Generate a key pair externally
 * - Pass the public key string to the service
 * - The operator auto-signs (no extra signers needed)
 *
 * Run: pnpm tsx src/account/create-account.ts
 */

import {
    AccountService,
    HieroContext,
    PrivateKey,
    Hbar,
} from "@hiero-enterprise/core";

const context = await HieroContext.build({
    network:
        (process.env["HIERO_NETWORK"] as "testnet" | "mainnet") ?? "testnet",
    operatorId: process.env["HIERO_OPERATOR_ID"]!,
    operatorKey: process.env["HIERO_OPERATOR_KEY"]!,
});

const accountService = new AccountService(context);

// Generate key pair — in production this would come from HSM/KMS/wallet
const newKey = PrivateKey.generateED25519();

const account = await accountService.createAccount({
    publicKey: newKey.publicKey.toStringRaw(),
    keyType: "ed25519" as any, // AccountType.ED25519
    initialBalance: new Hbar(1),
    memo: "standard account",
});

console.log("Created account:", account.accountId);
console.log("Public key:", account.publicKey);

context.client.close();
