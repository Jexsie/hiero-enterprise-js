import type { AccountId, Key } from "@hiero-ledger/sdk";

/**
 * Options controlling how a transaction is wrapped into a
 * `ScheduleCreateTransaction` instead of being executed immediately.
 *
 * When scheduling, the inner transaction is stored on-chain and can
 * collect signatures from other parties before it executes. Useful for
 * multi-sig workflows or deferred execution.
 *
 * @see https://docs.hedera.com/hedera/sdks-and-apis/sdks/schedule-transaction
 */
export interface ScheduleOptions {
    /**
     * Account that will pay for the scheduled transaction when it executes.
     * Defaults to the operator if not provided.
     */
    payerAccountId?: string | AccountId;

    /**
     * Admin key for the schedule entity. When set, the schedule can be
     * deleted before it executes via a `ScheduleDeleteTransaction`.
     * Without this, the schedule is immutable once created.
     */
    adminKey?: Key;

    /**
     * Memo for the schedule entity (max 100 bytes).
     * Visible in explorers and useful for identifying pending schedules.
     */
    scheduleMemo?: string;
}

/**
 * Returned when a transaction is successfully scheduled instead of executed.
 */
export interface ScheduledResult {
    /** The ID of the newly created schedule entity (e.g., `"0.0.12345"`). */
    scheduleId: string;
    /**
     * The transaction ID of the `ScheduleCreateTransaction` that created
     * this schedule entry.
     */
    transactionId: string;
}
