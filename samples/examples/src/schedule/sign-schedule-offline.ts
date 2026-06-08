/**
 * Schedule — sign with pre-computed offline signature.
 *
 * Use when a party's signature is produced on an air-gapped machine.
 * The transaction body bytes are serialised, transferred offline,
 * signed there, and the resulting signature bytes are attached here.
 *
 * Run: pnpm tsx src/schedule/sign-schedule-offline.ts
 */

import {
    AccountService,
    ScheduleService,
    HieroContext,
    PrivateKey,
} from "@hiero-enterprise/core";
import { getExampleConfig } from "../env.js";

async function main() {

    const context = new HieroContext(getExampleConfig());

    const accountService = new AccountService(context);
    const scheduleService = new ScheduleService(context);

    // Create a schedule to sign
    const { scheduleId } = await accountService.scheduleCreateAccount(
        {
            publicKey: PrivateKey.generateED25519().publicKey.toStringRaw(),
            memo: "offline-signed schedule",
        },
        { scheduleMemo: "awaiting air-gapped signature" },
    );

    console.log("Schedule created:", scheduleId);

    // In a real offline flow:
    //   1. Serialise the ScheduleSignTransaction to bytes
    //   2. Transfer bytes to air-gapped machine
    //   3. Air-gapped machine signs with its private key
    //   4. Get the signature bytes back (out-of-band)
    const offlineKey = PrivateKey.generateED25519();
    const offlineSignature = new Uint8Array(64); // replace with real bytes

    await scheduleService.sign({
        scheduleId,
        legacySignatures: [
            { publicKey: offlineKey.publicKey, signature: offlineSignature },
        ],
    });

    console.log("Signed with offline (pre-computed) signature");

    context.client.close();
}

void main();
