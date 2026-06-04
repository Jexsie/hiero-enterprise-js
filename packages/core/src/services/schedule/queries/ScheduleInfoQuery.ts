import type { ScheduleId } from "@hiero-ledger/sdk";
import { ScheduleInfoQuery as SdkScheduleInfoQuery } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { normalizeError } from "../../../errors/index.js";

/**
 * A plain-object representation of a schedule entity.
 *
 * Maps the SDK's `ScheduleInfo` to serialised strings so callers are not
 * coupled to SDK types.
 */
export interface ScheduleInfoResult {
    /** The schedule entity ID (e.g., `"0.0.12345"`). */
    scheduleId: string;
    /** Account that created the schedule. */
    creatorAccountId: string | null;
    /** Account that will pay when the scheduled transaction executes. */
    payerAccountId: string | null;
    /** The memo set on the schedule entity. */
    scheduleMemo: string | null;
    /**
     * Whether the inner transaction has already been executed.
     * Mutually exclusive with `isDeleted`.
     */
    isExecuted: boolean;
    /**
     * Whether the schedule was cancelled via `ScheduleDeleteTransaction`.
     * Mutually exclusive with `isExecuted`.
     */
    isDeleted: boolean;
    /**
     * Whether the schedule is still waiting for signatures.
     * `true` when neither `isExecuted` nor `isDeleted` is true.
     */
    isPending: boolean;
    /** ISO-8601 timestamp of when the inner transaction executed, or `null`. */
    executedAt: string | null;
    /** ISO-8601 timestamp of when the schedule was cancelled, or `null`. */
    deletedAt: string | null;
    /** ISO-8601 timestamp of when the schedule expires, or `null`. */
    expiresAt: string | null;
    /**
     * The transaction ID the inner transaction will use when it executes.
     * Useful for looking up the result after execution.
     */
    scheduledTransactionId: string | null;
    /** Number of keys that have signed the schedule so far. */
    signerCount: number;
    /**
     * Whether the schedule waits for its expiry time before executing even
     * if the signature threshold is met early.
     */
    waitForExpiry: boolean;
}

export class ScheduleInfoQuery {
    constructor(private readonly context: IHieroContext) {}

    /** Get schedule info execute handler. */
    async execute(
        scheduleId: string | ScheduleId,
    ): Promise<ScheduleInfoResult> {
        try {
            const info = await new SdkScheduleInfoQuery()
                .setScheduleId(scheduleId)
                .execute(this.context.client);

            const isExecuted = info.executed !== null;
            const isDeleted = info.deleted !== null;

            return {
                scheduleId: info.scheduleId.toString(),
                creatorAccountId: info.creatorAccountId?.toString() ?? null,
                payerAccountId: info.payerAccountId?.toString() ?? null,
                scheduleMemo: info.scheduleMemo,
                isExecuted,
                isDeleted,
                isPending: !isExecuted && !isDeleted,
                executedAt: info.executed
                    ? info.executed.toDate().toISOString()
                    : null,
                deletedAt: info.deleted
                    ? info.deleted.toDate().toISOString()
                    : null,
                expiresAt: info.expirationTime
                    ? info.expirationTime.toDate().toISOString()
                    : null,
                scheduledTransactionId:
                    info.scheduledTransactionId?.toString() ?? null,
                // signers is a KeyList — toArray() gives the individual keys
                signerCount: info.signers?.toArray().length ?? 0,
                waitForExpiry: info.waitForExpiry,
            };
        } catch (error) {
            throw normalizeError(error, "ScheduleService.getInfo");
        }
    }
}
