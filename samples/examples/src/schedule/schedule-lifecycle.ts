/**
 * Schedule — full lifecycle: create, sign, query, execute.
 *
 * Demonstrates the complete scheduled transaction workflow:
 *   1. Create a schedule wrapping an AccountCreateTransaction
 *   2. Query its initial state (pending, no signers)
 *   3. Sign with a local private key
 *   4. Sign with an external signer (HSM/KMS/wallet)
 *   5. Query final state (check if threshold met and executed)
 *
 * Run: pnpm tsx src/schedule/schedule-lifecycle.ts
 */

import {
    AccountService,
    ScheduleService,
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
    const scheduleService = new ScheduleService(context);

    // 1. Create a schedule
    const newAccountKey = PrivateKey.generateED25519();

    const scheduleOptions: ScheduleOptions = {
        scheduleMemo: "multi-party approval required",
    };

    const { scheduleId, transactionId } =
        await accountService.scheduleCreateAccount(
            {
                publicKey: newAccountKey.publicKey.toStringRaw(),
                initialBalance: 10,
                memo: "scheduled account",
            },
            scheduleOptions,
        );

    console.log("1. Schedule created");
    console.log("   scheduleId:", scheduleId);
    console.log("   transactionId:", transactionId);

    // 2. Query initial state
    const initialInfo = await scheduleService.getInfo(scheduleId);

    console.log("\n2. Initial state");
    console.log("   isPending:", initialInfo.isPending);
    console.log("   signerCount:", initialInfo.signerCount);
    console.log("   scheduleMemo:", initialInfo.scheduleMemo);

    // 3. Sign with a local private key
    const partyAKey = PrivateKey.generateED25519();

    await scheduleService.sign({
        scheduleId,
        additionalSigners: [partyAKey],
    });

    console.log("\n3. Party A signed (local key)");

    // 4. Sign with an external signer (HSM/KMS)
    const partyBKey = PrivateKey.generateECDSA(); // simulated HSM key
    const partyBSigner = {
        publicKey: partyBKey.publicKey,
        sign: async (message: Uint8Array): Promise<Uint8Array> => {
            // Production: return await kmsClient.sign(keyId, message);
            return partyBKey.sign(message);
        },
    };

    await scheduleService.sign({
        scheduleId,
        externalSigners: [partyBSigner],
    });

    console.log("4. Party B signed (external signer)");

    // 5. Query final state
    const finalInfo = await scheduleService.getInfo(scheduleId);

    console.log("\n5. Final state");
    console.log("   isExecuted:", finalInfo.isExecuted);
    console.log("   isPending:", finalInfo.isPending);
    console.log("   signerCount:", finalInfo.signerCount);

    context.client.close();
}

void main();
