import type {
    Key,
    Long,
    AccountId,
    CustomFixedFee,
    Timestamp,
    TopicId,
} from "@hiero-ledger/sdk";
import { TopicUpdateTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
    ScheduledResult,
} from "../../transaction/index.js";
import { TopicUpdateValidator } from "../validation/index.js";

/**
 * Low-level options for the `TopicUpdate` SDK transaction.
 *
 * Mirrors the surface of `TopicUpdateTransaction`. Callers usually go
 * through `TopicService.updateTopic`, which exposes the same shape.
 *
 * Field semantics on every optional setter follow a three-state pattern:
 *
 *  - **omitted (undefined)** — leave the current network value unchanged
 *  - **`null`**               — clear the field on the network
 *  - **a value**              — replace the current value with the
 *                               provided one
 *
 * Signing rules (enforced by the network, not this validator):
 *
 *  - A topic without an `adminKey` is mutable only via `expirationTime`
 *    extension. Every other field requires the existing admin key.
 *  - Rotating the `adminKey` requires signatures from BOTH the old and
 *    the new admin keys — pass both via `additionalSigners`.
 *  - Switching to a new `autoRenewAccountId` requires that account's
 *    signature too.
 *
 * Extends `TransactionOptions` for fees, validity window, additional
 * signers, and scheduling.
 */
export interface TopicUpdateOperationOptions extends TransactionOptions {
    /** Topic to update. */
    topicId: string | TopicId;
    /** New topic-level memo (max 100 bytes). `null` clears the memo. */
    topicMemo?: string | null;
    /** Replace the admin key. `null` makes the topic immutable. */
    adminKey?: Key | null;
    /** Replace the submit key. `null` makes the topic public. */
    submitKey?: Key | null;
    /** Replace the fee-schedule key (HIP-991). `null` clears it. */
    feeScheduleKey?: Key | null;
    /** Replace the fee-exempt keys (HIP-991). `null` clears them. */
    feeExemptKeys?: Key[] | null;
    /** Replace the auto-renew account. `null` clears it. */
    autoRenewAccountId?: string | AccountId | null;
    /** New auto-renew period, in seconds. */
    autoRenewPeriod?: Long | number;
    /** Replace the custom fees (HIP-991). `null` clears them. */
    customFees?: CustomFixedFee[] | null;
    /** Extend the topic's expiration. */
    expirationTime?: Timestamp | Date;
}

export class TopicUpdateOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: TopicUpdateValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new TopicUpdateValidator();
    }

    /** Submit a `TopicUpdateTransaction`. */
    async execute(options: TopicUpdateOperationOptions): Promise<void> {
        this.validator.validate(options);

        const tx = this.build(options);

        await this.executor.run(
            tx,
            options,
            {
                type: "TopicUpdate",
                serviceName: "TopicService",
                methodName: "updateTopic",
                timestamp: new Date(),
            },
            () => undefined,
        );
    }

    /** Schedule a `TopicUpdateTransaction` for deferred multi-sig execution. */
    async schedule(
        options: TopicUpdateOperationOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.scheduleRun(
            tx,
            options,
            {
                type: "TopicUpdate",
                serviceName: "TopicService",
                methodName: "updateTopic",
                timestamp: new Date(),
            },
            scheduleOptions,
        );
    }

    /**
     * Construct the `TopicUpdateTransaction` from the caller-provided
     * options. Only setters for fields that were actually provided are
     * invoked. `null` triggers the corresponding `clearX()` setter, a
     * value triggers `setX()`, and `undefined` leaves the field alone.
     */
    private build(
        options: TopicUpdateOperationOptions,
    ): TopicUpdateTransaction {
        const tx = new TopicUpdateTransaction().setTopicId(options.topicId);

        if (options.topicMemo === null) {
            tx.clearTopicMemo();
        } else if (options.topicMemo !== undefined) {
            tx.setTopicMemo(options.topicMemo);
        }

        if (options.adminKey === null) {
            tx.clearAdminKey();
        } else if (options.adminKey !== undefined) {
            tx.setAdminKey(options.adminKey);
        }

        if (options.submitKey === null) {
            tx.clearSubmitKey();
        } else if (options.submitKey !== undefined) {
            tx.setSubmitKey(options.submitKey);
        }

        if (options.feeScheduleKey === null) {
            tx.clearFeeScheduleKey();
        } else if (options.feeScheduleKey !== undefined) {
            tx.setFeeScheduleKey(options.feeScheduleKey);
        }

        if (options.feeExemptKeys === null) {
            tx.clearFeeExemptKeys();
        } else if (options.feeExemptKeys !== undefined) {
            tx.setFeeExemptKeys(options.feeExemptKeys);
        }

        if (options.autoRenewAccountId === null) {
            tx.clearAutoRenewAccountId();
        } else if (options.autoRenewAccountId !== undefined) {
            tx.setAutoRenewAccountId(options.autoRenewAccountId);
        }

        if (options.autoRenewPeriod != null) {
            tx.setAutoRenewPeriod(options.autoRenewPeriod);
        }

        if (options.customFees === null) {
            tx.clearCustomFees();
        } else if (options.customFees !== undefined) {
            tx.setCustomFees(options.customFees);
        }

        if (options.expirationTime != null) {
            tx.setExpirationTime(options.expirationTime);
        }

        return tx;
    }
}
