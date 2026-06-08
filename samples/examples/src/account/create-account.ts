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
    AccountType,
    HieroContext,
    PrivateKey,    Hbar,
} from "@hiero-enterprise/core";

async function main() {
    if (
        process.env["HIERO_OPERATOR_ID"] == null ||
        process.env["HIERO_OPERATOR_KEY"] == null
    ) {
        throw new Error(
            "Environment variables HIERO_OPERATOR_ID and HIERO_OPERATOR_KEY are required.",
        );
    }

    const context = new HieroContext({
        network:
            (process.env["HIERO_NETWORK"] as "testnet" | "mainnet") ??
            "testnet",
        operatorId: process.env["HIERO_OPERATOR_ID"],
        operatorKey: process.env["HIERO_OPERATOR_KEY"],
        operatorKeyType: process.env["HIERO_OPERATOR_KEY_TYPE"] ?? "ed25519",
    });

    const accountService = new AccountService(context);

    // Generate key pair — in production this would come from HSM/KMS/wallet
    const newKey = PrivateKey.generateED25519();

    const account = await accountService.createAccount({
        publicKey: newKey.publicKey.toStringRaw(),
        keyType: AccountType.ED25519,
        initialBalance: new Hbar(1),
        memo: "standard account",
    });

    console.log("Created account:", account.accountId);
    console.log("Public key:", account.publicKey);

    context.client.close();
}

void main();
