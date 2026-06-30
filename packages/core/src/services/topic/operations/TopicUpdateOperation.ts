import type {
    Key,
    Long,
    AccountId,
    CustomFixedFee,
    Timestamp,
    TopicId,
} from "@hiero-ledger/sdk";
import { TopicUpdateTransaction, KeyList } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { TopicUpdateValidator } from "../validation/index.js";

/**
 * Canonical Hedera sentinel for clearing the auto-renew account on a
 * topic — `AccountID(0, 0, 0)`. The Java SDK uses the same value; the
 * JS SDK's `clearAutoRenewAccountId()` is buggy (sets the local field
 * to `null`, which protobuf drops as "absent" / no-op), so we route
 * around it via `setAutoRenewAccountId("0.0.0")`.
 */
const SENTINEL_CLEAR_AUTO_RENEW_ACCOUNT = "0.0.0";

/**
 * Low-level options for the `TopicUpdate` SDK transaction.
 *
 * Mirrors the surface of `TopicUpdateTransaction`. Callers usually go
 * through `TopicService.updateTopic`, which exposes the same shape.
 *
 * Most optional fields follow a three-state pattern:
 *
 *  - **omitted (undefined)** — leave the current network value unchanged
 *  - **`null`**               — clear the field on the network (only
 *                               supported on fields explicitly typed
 *                               `T | null`)
 *  - **a value**              — replace the current value with the
 *                               provided one
 *
 * Fields typed `T | undefined` (without `null`) are **not clearable** —
 * the SDK exposes no `clearX()` for them. The validator rejects `null`
 * on these fields (in JS callers without TypeScript guard rails) so the
 * caller's intent isn't silently dropped.
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
 * `TopicUpdate` is **not whitelisted for scheduling** on the network,
 * so no `schedule()` variant is exposed.
 *
 * Extends `TransactionOptions` for fees, validity window, and additional
 * signers.
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
    /**
     * New auto-renew period, in seconds. **Not clearable** — passing
     * `null` is rejected by the validator. Omit to leave unchanged.
     */
    autoRenewPeriod?: Long | number;
    /** Replace the custom fees (HIP-991). `null` clears them. */
    customFees?: CustomFixedFee[] | null;
    /**
     * Extend the topic's expiration. **Not clearable** — passing `null`
     * is rejected by the validator. Omit to leave unchanged.
     */
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

    /**
     * Construct the `TopicUpdateTransaction` from the caller-provided
     * options. Only setters for fields that were actually provided are
     * invoked. A value triggers `setX(value)`, `undefined` leaves the
     * field alone, and `null` writes the canonical Hedera clear sentinel
     * for that field.
     *
     * **Why we route around `tx.clearX()` for most fields:** the JS SDK
     * (`@hiero-ledger/sdk` v2.85.0) implements `clearAdminKey`,
     * `clearSubmitKey`, `clearFeeScheduleKey`, `clearAutoRenewAccountId`
     * and `clearTopicMemo` by setting the local field to `null` — and
     * the protobuf serializer then drops the field entirely. The
     * consensus node interprets an absent field as "leave unchanged",
     * so those `clearX()` calls are silently no-ops on the network.
     *
     * The HAPI / Java-SDK contract is instead to clear via sentinel
     * values:
     *  - `Key`-typed fields → an empty `KeyList`
     *  - `topicMemo`        → an empty string (`StringValue { value: "" }`)
     *  - `autoRenewAccountId` → `AccountID(0, 0, 0)`
     *
     * `clearFeeExemptKeys()` and `clearCustomFees()` already use the
     * correct sentinel (empty list), so we keep them.
     */
    private build(
        options: TopicUpdateOperationOptions,
    ): TopicUpdateTransaction {
        const tx = new TopicUpdateTransaction().setTopicId(options.topicId);

        if (options.topicMemo === null) {
            // SDK `clearTopicMemo()` is a no-op on the network — use the
            // empty-string sentinel that the consensus node honours.
            tx.setTopicMemo("");
        } else if (options.topicMemo !== undefined) {
            tx.setTopicMemo(options.topicMemo);
        }

        if (options.adminKey === null) {
            tx.setAdminKey(new KeyList());
        } else if (options.adminKey !== undefined) {
            tx.setAdminKey(options.adminKey);
        }

        if (options.submitKey === null) {
            tx.setSubmitKey(new KeyList());
        } else if (options.submitKey !== undefined) {
            tx.setSubmitKey(options.submitKey);
        }

        if (options.feeScheduleKey === null) {
            tx.setFeeScheduleKey(new KeyList());
        } else if (options.feeScheduleKey !== undefined) {
            tx.setFeeScheduleKey(options.feeScheduleKey);
        }

        if (options.feeExemptKeys === null) {
            // `clearFeeExemptKeys()` correctly emits an empty list — the
            // canonical sentinel for clearing this field.
            tx.clearFeeExemptKeys();
        } else if (options.feeExemptKeys !== undefined) {
            tx.setFeeExemptKeys(options.feeExemptKeys);
        }

        if (options.autoRenewAccountId === null) {
            tx.setAutoRenewAccountId(SENTINEL_CLEAR_AUTO_RENEW_ACCOUNT);
        } else if (options.autoRenewAccountId !== undefined) {
            tx.setAutoRenewAccountId(options.autoRenewAccountId);
        }

        if (options.customFees === null) {
            // `clearCustomFees()` correctly emits an empty list — the
            // canonical sentinel for clearing this field.
            tx.clearCustomFees();
        } else if (options.customFees !== undefined) {
            tx.setCustomFees(options.customFees);
        }

        if (options.autoRenewPeriod != null) {
            tx.setAutoRenewPeriod(options.autoRenewPeriod);
        }

        if (options.expirationTime != null) {
            tx.setExpirationTime(options.expirationTime);
        }

        return tx;
    }
}
