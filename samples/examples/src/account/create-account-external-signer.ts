/**
 * Create Account — external signer (wallet, HSM, or KMS).
 *
 * Use when the signing key never leaves a secure boundary (hardware wallet,
 * cloud KMS, HSM). You provide the public key and an async signing function —
 * the private key material is never exposed to this library.
 *
 * In production, replace the body of `sign` with a call to your KMS/HSM SDK.
 *
 * Run: pnpm tsx src/account/create-account-external-signer.ts
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

    const context = await HieroContext.build({
        network:
            (process.env["HIERO_NETWORK"] as "testnet" | "mainnet") ??
            "testnet",
        operatorId: process.env["HIERO_OPERATOR_ID"],
        operatorKey: process.env["HIERO_OPERATOR_KEY"],
    });

    const accountService = new AccountService(context);

    const newKey = PrivateKey.generateED25519();

    // Simulated external wallet — in production, call your wallet SDK or KMS API
    const walletKey = PrivateKey.generateECDSA();
    const walletSigner = {
        publicKey: walletKey.publicKey,
        sign: async (message: Uint8Array): Promise<Uint8Array> => {
            // Production examples:
            //   return await kmsClient.sign(keyId, message);
            //   return await ledger.sign(derivationPath, message);
            //   return await hashConnect.sign(accountId, message);
            return walletKey.sign(message);
        },
    };

    const account = await accountService.createAccount({
        publicKey: newKey.publicKey.toStringRaw(),
        memo: "wallet-signed account",
        externalSigners: [walletSigner], // async sign fn — key never exposed
    });

    console.log("External signer account created:", account.accountId);

    context.client.close();
}

void main();

context.client.close();
