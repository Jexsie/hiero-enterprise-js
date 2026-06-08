/**
 * Create Account — pre-computed (offline) signature.
 *
 * Use when the signature is produced completely offline (air-gapped signer,
 * cold wallet) and delivered out-of-band. The signature bytes are attached
 * to the transaction before submission.
 *
 * Real offline flow:
 *   1. Build and freeze the transaction
 *   2. Serialise to bytes → transfer to air-gapped machine
 *   3. Air-gapped machine signs → returns signature bytes
 *   4. Attach signature bytes here via legacySignatures
 *   5. Submit
 *
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

    // Signature produced offline — in production this comes from your air-gapped system
    const offlineKey = PrivateKey.generateED25519();
    const placeholderSignature = new Uint8Array(64); // replace with real bytes

    const account = await accountService.createAccount({
        publicKey: newKey.publicKey.toStringRaw(),
        memo: "offline-signed account",
        legacySignatures: [
            {
                publicKey: offlineKey.publicKey,
                signature: placeholderSignature,
            },
        ],
    });

    console.log("Offline-signed account created:", account.accountId);

    context.client.close();
}

void main();
