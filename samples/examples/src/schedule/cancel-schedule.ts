/**
 * Schedule — cancel a pending schedule.
 *
 * A schedule can be cancelled (deleted) before it executes, but ONLY if
 * an `adminKey` was set during creation. Without an adminKey, the schedule
 * is immutable and will either execute when threshold is met or expire.
 *
 * Run: pnpm tsx src/schedule/cancel-schedule.ts
 */

import {
    AccountService,
    ScheduleService,
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
    const scheduleService = new ScheduleService(context);

    // Create a schedule with an adminKey so it can be cancelled
    const adminKey = PrivateKey.generateED25519();

    const { scheduleId } = await accountService.scheduleCreateAccount(
        {
            publicKey: PrivateKey.generateED25519().publicKey.toStringRaw(),
            memo: "this will be cancelled",
        },
        {
            scheduleMemo: "cancellable schedule",
            adminKey: adminKey.publicKey,
        },
    );

    console.log("Schedule created:", scheduleId);

    // Cancel the schedule before it executes
    await scheduleService.cancel({
        scheduleId,
        adminKey,
    });

    // Verify it was deleted
    const info = await scheduleService.getInfo(scheduleId);

    console.log("Cancelled:", info.isDeleted);

    context.client.close();
}

void main();
