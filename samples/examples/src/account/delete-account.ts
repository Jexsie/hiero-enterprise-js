/**
 * Delete Account — remove an account and sweep remaining balance.
 *
 * Demonstrates:
 * 1. Immediate deletion (account key required)
 * 2. Scheduled deletion (key collected later via ScheduleSign)
 *
 * Run: pnpm tsx src/account/delete-account.ts
 */

import {
    AccountService,
    HieroContext,
    PrivateKey,
    Hbar,
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

    // 1. Immediate deletion
    // The account's private key must be provided to authorize deletion.
    // Remaining balance is swept to `transferAccountId` (defaults to operator).
    const key = PrivateKey.generateED25519();
    const account = await accountService.createAccount({
        publicKey: key.publicKey.toStringRaw(),
        initialBalance: new Hbar(1),
    });

    console.log("Created account:", account.accountId);

    await accountService.deleteAccount({
        accountId: account.accountId,
        accountKey: key,
        // transferAccountId: "0.0.200",  // optional — defaults to operator
    });

    console.log("1. Deleted:", account.accountId);

    // 2. Scheduled deletion
    // Use when the account owner's signature will be collected later.
    // No accountKey needed at scheduling time — the schedule stores the intent,
    // and the owner signs via ScheduleSignTransaction.
    const scheduleKey = PrivateKey.generateED25519();
    const scheduleAccount = await accountService.createAccount({
        publicKey: scheduleKey.publicKey.toStringRaw(),
        initialBalance: new Hbar(1),
    });

    const scheduled = await accountService.scheduleDeleteAccount(
        { accountId: scheduleAccount.accountId },
        { scheduleMemo: "awaiting owner approval" },
    );

    console.log("\n2. Deletion scheduled");
    console.log("   Schedule ID:", scheduled.scheduleId);
    console.log("   Transaction ID:", scheduled.transactionId);
    console.log(
        "   → Owner signs via ScheduleSignTransaction to trigger execution",
    );

    context.client.close();
}

void main();
