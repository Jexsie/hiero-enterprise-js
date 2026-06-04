/**
 * Schedule management patterns — standalone reference script.
 *
 * Shows the complete lifecycle of a scheduled transaction:
 *   1. Schedule creation  — wrap any transaction in a ScheduleCreateTransaction
 *   2. Sign               — each required party adds their signature
 *   3. Sign via HSM/KMS   — external signer (key never exposed)
 *   4. Sign with offline  — pre-computed signature via _addSignatureLegacy
 *   5. Query state        — check who has signed, whether it executed
 *   6. Cancel             — delete the schedule before it executes (requires adminKey)
 *
 * Run:  tsx samples/schedule-patterns.ts
 *
 * Prerequisites:
 *   - HIERO_NETWORK, HIERO_OPERATOR_ID, HIERO_OPERATOR_KEY set in env
 *     (copy samples/express-sample/.env.example for reference)
 */

import {
    AccountService,
    ScheduleService,
    HieroContext,
    PrivateKey,
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
const scheduleService = new ScheduleService(context);

// ─── Step 1: Create a schedule ────────────────────────────────────────────────
// Schedule an account creation requiring 2-of-3 approvals.
// The inner AccountCreateTransaction is stored on-chain — it will not execute
// until enough parties have signed.

const newAccountKey = PrivateKey.generateED25519();

// adminKey lets us cancel the schedule if needed; omit for immutable schedules
const adminKey = PrivateKey.generateED25519();

const scheduleOptions: ScheduleOptions = {
    scheduleMemo: "2-of-3 treasury approval required",
    adminKey: adminKey,
};

const { scheduleId, transactionId: scheduleTxId } =
    await accountService.scheduleCreateAccount(
        {
            publicKey: newAccountKey.publicKey.toString(),
            initialBalance: 10,
            memo: "multi-party approved account",
        },
        scheduleOptions,
    );

console.log("1. Schedule created");
console.log("   scheduleId:      ", scheduleId);
console.log("   scheduleTxId:    ", scheduleTxId);
console.log("   — Account will NOT be created until threshold is met.");

// ─── Step 2: Check initial state ─────────────────────────────────────────────
// Query the schedule before anyone has signed.

const initialInfo = await scheduleService.getInfo(scheduleId);

console.log("\n2. Initial state");
console.log("   isPending:       ", initialInfo.isPending);   // true
console.log("   signerCount:     ", initialInfo.signerCount); // 0
console.log("   scheduleMemo:    ", initialInfo.scheduleMemo);
console.log("   expiresAt:       ", initialInfo.expiresAt);
console.log("   scheduledTxId:   ", initialInfo.scheduledTransactionId);

// ─── Step 3: Party A signs with a local private key ───────────────────────────
// Each party calls sign() once. The executor freezes the ScheduleSignTransaction,
// applies the signer, then executes — collecting one more signature on-chain.

const partyAKey = PrivateKey.generateED25519();

await scheduleService.sign({
    scheduleId,
    additionalSigners: [partyAKey],
});

const afterPartyA = await scheduleService.getInfo(scheduleId);
console.log("\n3. After Party A signed");
console.log("   signerCount:     ", afterPartyA.signerCount); // 1
console.log("   isPending:       ", afterPartyA.isPending);

// ─── Step 4: Party B signs via an external signer (HSM / KMS / wallet) ───────
// The private key never enters this process.
// Replace the sign() body with your actual KMS/HSM SDK call in production.

const partyBKey = PrivateKey.generateECDSA(); // simulated HSM key
const partyBExternalSigner = {
    publicKey: partyBKey.publicKey,
    sign: async (message: Uint8Array): Promise<Uint8Array> => {
        // Production: return await kmsClient.sign(keyId, message);
        //             return await ledger.sign(derivationPath, message);
        return partyBKey.sign(message);
    },
};

await scheduleService.sign({
    scheduleId,
    externalSigners: [partyBExternalSigner],
});

console.log("\n4. After Party B signed via external signer (HSM/wallet)");

// ─── Step 5: Party C signs with a pre-computed offline signature ──────────────
// Use when the signature is produced completely offline (air-gapped machine).
// The transaction body bytes are serialised, sent to the air-gapped signer,
// and the resulting signature bytes are attached here.

const partyCKey = PrivateKey.generateED25519();
// In a real offline flow: serialise the ScheduleSignTransaction to bytes,
// transfer to the air-gapped machine, get the signature back.
const offlineSignature = new Uint8Array(64); // ← replace with real bytes

await scheduleService.sign({
    scheduleId,
    legacySignatures: [
        { publicKey: partyCKey.publicKey, signature: offlineSignature },
    ],
});

console.log("\n5. After Party C signed with offline (pre-computed) signature");

// ─── Step 6: Query final state ────────────────────────────────────────────────
// Check whether the threshold was met and the inner transaction executed.

const finalInfo = await scheduleService.getInfo(scheduleId);

console.log("\n6. Final state");
console.log("   isExecuted:      ", finalInfo.isExecuted);
console.log("   isPending:       ", finalInfo.isPending);
console.log("   executedAt:      ", finalInfo.executedAt ?? "(not yet)");
console.log("   signerCount:     ", finalInfo.signerCount);

// ─── Step 7: Cancel a different schedule (requires adminKey) ─────────────────
// Shows the cancel path. Create a fresh schedule that we immediately cancel.

const { scheduleId: cancelableId } =
    await accountService.scheduleCreateAccount(
        {
            publicKey: PrivateKey.generateED25519().publicKey.toString(),
            memo: "this one will be cancelled",
        },
        {
            scheduleMemo: "cancellable schedule",
            adminKey,   // same admin key — required to delete
        },
    );

console.log("\n7. Created cancellable schedule:", cancelableId);

await scheduleService.cancel({
    scheduleId: cancelableId,
    adminKey,
});

const cancelledInfo = await scheduleService.getInfo(cancelableId);
console.log("   isDeleted:       ", cancelledInfo.isDeleted);  // true
console.log("   deletedAt:       ", cancelledInfo.deletedAt);

// ─── Cleanup ──────────────────────────────────────────────────────────────────

context.client.close();
