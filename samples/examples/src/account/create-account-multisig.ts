/**
 * Create Account — multi-sig with additional private key co-signers.
 *
 * Use when the AccountCreateTransaction must be co-signed by keys you hold
 * locally (e.g., a treasury key, compliance key, or threshold key member).
 *
 * The executor freezes the transaction, signs with each key in order,
 * then the operator auto-signs during execute().
 *
 * Run: pnpm tsx src/account/create-account-multisig.ts
 */

import {
    AccountService,
    HieroContext,
    PrivateKey,
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
        network: process.env["HIERO_NETWORK"] ?? "testnet",
        operatorId: process.env["HIERO_OPERATOR_ID"],
        operatorKey: process.env["HIERO_OPERATOR_KEY"],
        operatorKeyType: process.env["HIERO_OPERATOR_KEY_TYPE"] ?? "ed25519",
        mirrorNodeUrl: process.env["HIERO_MIRROR_NODE_URL"],
    });

    const accountService = new AccountService(context);

    const newKey = PrivateKey.generateED25519();
    const cosignerKey = PrivateKey.generateED25519(); // a key you hold locally

    const account = await accountService.createAccount({
        publicKey: newKey.publicKey.toStringRaw(),
        memo: "multi-sig account",
        additionalSigners: [cosignerKey], // co-signer key as a signer
    });

    console.log("Multi-sig account created:", account.accountId);

    context.client.close();
}

void main();
