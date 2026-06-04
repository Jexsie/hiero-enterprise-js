/**
 * Account creation patterns — standalone reference script.
 *
 * Covers every signing mode the AccountService supports:
 *   1. Standard       — operator auto-signs, no extra keys
 *   2. Multi-sig      — additional PrivateKey co-signers
 *   3. External signer — async signing function (wallet, HSM, KMS)
 *   4. Pre-computed   — offline signature via _addSignatureLegacy
 *   5. Scheduled      — deferred multi-sig via ScheduleCreateTransaction
 *   6. Delete         — account deletion with accountKey
 *   7. Schedule-delete — deferred deletion, no key needed at schedule time
 *
 * Run:  tsx samples/account-patterns.ts
 *
 * Prerequisites:
 *   - HIERO_NETWORK, HIERO_OPERATOR_ID, HIERO_OPERATOR_KEY set in env
 *     (copy samples/express-sample/.env.example for reference)
 */

import {
    AccountService,
    HieroContext,
    PrivateKey,
    Hbar,
} from "@hiero-enterprise/core";
import type { ScheduleOptions } from "@hiero-enterprise/core";

// ─── Setup ────────────────────────────────────────────────────────────────────

const context = await HieroContext.build({
    network:
        (process.env["HIERO_NETWORK"] as "testnet" | "mainnet") ?? "testnet",
    operatorId: process.env["HIERO_OPERATOR_ID"]!,
    operatorKey: process.env["HIERO_OPERATOR_KEY"]!,
});

const accountService = new AccountService(context);

// ─── 1. Standard account creation ─────────────────────────────────────────────
// The operator key (from HieroContext) is the only signer.
// Most common pattern — use when you control the operator and no co-signers exist.

{
    const newKey = PrivateKey.generateED25519();

    const account = await accountService.createAccount({
        publicKey: newKey.publicKey.toString(),
        initialBalance: 1, // seed with 1 HBAR
        memo: "standard account",
        maxTransactionFee: new Hbar(2), // optional: cap the fee
    });

    console.log("1. Standard:", account.accountId);
}

// ─── 2. Multi-sig — additional PrivateKey co-signers ──────────────────────────
// Use when the creating transaction must be co-signed by keys you hold locally
// (e.g., a treasury key, a compliance key, or a threshold key member).
// The executor freezes the tx, signs with each key in order, then executes.

{
    const newKey = PrivateKey.generateED25519();
    const cosignerKey = PrivateKey.generateED25519(); // key you hold locally

    const account = await accountService.createAccount({
        publicKey: newKey.publicKey.toString(),
        memo: "multi-sig account",
        additionalSigners: [cosignerKey], // ← added after operator auto-sign
    });

    console.log("2. Multi-sig:", account.accountId);
}

// ─── 3. External signer — wallet, HSM, or KMS ────────────────────────────────
// Use when the signing key never leaves a secure boundary (hardware wallet,
// cloud KMS, HSM). You provide the public key and an async signing function —
// the private key material is never exposed to this library.
//
// In production replace the body of `sign` with a call to your KMS/HSM SDK.

{
    const newKey = PrivateKey.generateED25519();

    // Simulated external wallet — in prod, call your wallet SDK or KMS API
    const walletKey = PrivateKey.generateECDSA();
    const walletSigner = {
        publicKey: walletKey.publicKey,
        sign: async (message: Uint8Array): Promise<Uint8Array> => {
            // In production: return await kmsClient.sign(keyId, message);
            return walletKey.sign(message);
        },
    };

    const account = await accountService.createAccount({
        publicKey: newKey.publicKey.toString(),
        memo: "wallet-signed account",
        externalSigners: [walletSigner], // ← async sign fn, key never exposed
    });

    console.log("3. External signer:", account.accountId);
}

// ─── 4. Pre-computed (offline) signature via _addSignatureLegacy ──────────────
// Use when the signature is produced completely offline (air-gapped signer,
// cold wallet) and delivered out-of-band. Attach it before submission.

{
    const newKey = PrivateKey.generateED25519();

    // Signature produced offline — in prod this comes from your air-gapped system
    const offlineKey = PrivateKey.generateED25519();
    // The message to sign is the serialised transaction body — in a real offline
    // flow you would serialise the tx to bytes, ship to the air-gapped machine,
    // get the signature back, and attach it here.
    const placeholderSignature = new Uint8Array(64); // replace with real bytes

    const account = await accountService.createAccount({
        publicKey: newKey.publicKey.toString(),
        memo: "offline-signed account",
        legacySignatures: [
            {
                publicKey: offlineKey.publicKey,
                signature: placeholderSignature,
            },
        ],
    });

    console.log("4. Pre-computed signature:", account.accountId);
}

// ─── 5. Scheduled account creation ────────────────────────────────────────────
// Use for multi-party approval workflows. The inner AccountCreateTransaction is
// stored on-chain as a schedule. Other parties submit ScheduleSignTransaction
// with their keys; once the threshold is met the account is created automatically.

{
    const newKey = PrivateKey.generateED25519();

    const scheduleOptions: ScheduleOptions = {
        scheduleMemo: "pending treasury approval",
        // adminKey: treasuryKey.publicKey,  // set if you need to be able to cancel
    };

    const scheduled = await accountService.scheduleCreateAccount(
        {
            publicKey: newKey.publicKey.toString(),
            initialBalance: 5,
            memo: "scheduled account",
        },
        scheduleOptions,
    );

    // Returns immediately — the account does NOT exist yet.
    // Other parties sign at: ScheduleSignTransaction.setScheduleId(scheduled.scheduleId)
    console.log("5. Scheduled, scheduleId:", scheduled.scheduleId);
    console.log("   ScheduleCreate txId:  ", scheduled.transactionId);
}

// ─── 6. Delete an account ──────────────────────────────────────────────────────
// The account being deleted must provide its own private key (accountKey).
// The executor freezes, signs with accountKey, then the operator auto-signs.
// Remaining balance is swept to transferAccountId (defaults to operator).

{
    // In practice you would not generate a fresh key here — you'd have created
    // the account earlier and kept its private key.
    const doomed = PrivateKey.generateED25519();
    const doomedAccount = await accountService.createAccount({
        publicKey: doomed.publicKey.toString(),
        initialBalance: 1,
    });

    await accountService.deleteAccount({
        accountId: doomedAccount.accountId,
        accountKey: doomed, // required — authorises the deletion
        // transferAccountId: "0.0.200",    // optional — defaults to operator
    });

    console.log("6. Deleted:", doomedAccount.accountId);
}

// ─── 7. Schedule account deletion ─────────────────────────────────────────────
// Use when the account owner's signature will be collected later.
// No accountKey is needed at schedule time — the owner signs via
// ScheduleSignTransaction once the schedule is on-chain.

{
    const target = PrivateKey.generateED25519();
    const targetAccount = await accountService.createAccount({
        publicKey: target.publicKey.toString(),
        initialBalance: 1,
    });

    const scheduled = await accountService.scheduleDeleteAccount(
        {
            accountId: targetAccount.accountId,
            // transferAccountId: "0.0.200",  // optional
        },
        {
            scheduleMemo: "awaiting account-owner signature",
        },
    );

    // The deletion is pending — the account owner submits ScheduleSignTransaction
    // with `target` (the account's private key) to trigger execution.
    console.log("7. Delete scheduled, scheduleId:", scheduled.scheduleId);
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

context.client.close();
