/**
 * Create Account — scheduled (deferred multi-sig).
 *
 * The inner AccountCreateTransaction is stored on-chain as a schedule.
 * Other parties submit ScheduleSignTransaction with their keys;
 * once the threshold is met the account is created automatically.
 *
 * Use for multi-party approval workflows where not all signers
 * are available at the same time.
 *
 * Run: pnpm tsx src/account/create-account-scheduled.ts
 */

import {
    AccountService,
    HieroContext,
    PrivateKey,
} from "@hiero-enterprise/core";
import type { ScheduleOptions } from "@hiero-enterprise/core";

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

    const scheduleOptions: ScheduleOptions = {
        scheduleMemo: "pending treasury approval",
        // adminKey: treasuryKey.publicKey,  // set if you need to cancel later
    };

    const scheduled = await accountService.scheduleCreateAccount(
        {
            publicKey: newKey.publicKey.toStringRaw(),
            initialBalance: 5,
            memo: "scheduled account",
        },
        scheduleOptions,
    );

    // Returns immediately — the account does NOT exist yet.
    // Other parties sign via: ScheduleSignTransaction.setScheduleId(scheduled.scheduleId)
    console.log("Schedule created");
    console.log("  scheduleId:", scheduled.scheduleId);
    console.log("  transactionId:", scheduled.transactionId);

    context.client.close();
}

void main();
