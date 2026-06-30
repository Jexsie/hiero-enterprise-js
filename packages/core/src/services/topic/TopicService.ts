import type { IHieroContext } from "../../context/index.js";
import type { ScheduleOptions, ScheduledResult } from "../transaction/index.js";
import {
    TopicCreateOperation,
    TopicUpdateOperation,
    TopicDeleteOperation,
    TopicMessageSubmitOperation,
} from "./operations/index.js";
import type {
    TopicCreateOperationOptions,
    TopicUpdateOperationOptions,
    TopicDeleteOperationOptions,
    TopicMessageSubmitOperationOptions,
    TopicMessageSubmitResult,
} from "./operations/index.js";

/**
 * Options for creating a topic via `TopicCreateTransaction`.
 *
 * Topics are append-only, timestamped, ordered message logs with
 * consensus guarantees. Set `submitKey` to make the topic private
 * (only signers holding it may submit messages); leave it unset for a
 * public topic. Set `adminKey` to keep the topic mutable (the key holder
 * may later update or delete it); leave it unset for an immutable
 * topic.
 */
export type CreateTopicOptions = TopicCreateOperationOptions;

/**
 * Options for updating a topic via `TopicUpdateTransaction`.
 *
 * Every optional field follows a three-state convention:
 *
 *  - **omitted (undefined)** — leave the field unchanged
 *  - **`null`**               — clear the field on the network
 *  - **a value**              — replace the existing value
 */
export type UpdateTopicOptions = TopicUpdateOperationOptions;

/**
 * Options for deleting a topic via `TopicDeleteTransaction`.
 *
 * Deletion is permanent — no further transactions or queries on the
 * topic will succeed. The topic's `adminKey` must sign; topics created
 * without an `adminKey` cannot be deleted.
 */
export type DeleteTopicOptions = TopicDeleteOperationOptions;

/**
 * Options for submitting a message to a topic via
 * `TopicMessageSubmitTransaction`.
 *
 * If the topic has a `submitKey`, that key MUST sign — pass it via
 * `additionalSigners`. Messages larger than the chunk size are
 * automatically split into multiple chunks by the SDK; the returned
 * receipt corresponds to the first chunk.
 */
export type SubmitMessageOptions = TopicMessageSubmitOperationOptions;

/**
 * Receipt-derived result returned by `submitMessage` — sequence number,
 * running hash, and transaction ID of the first (or only) chunk.
 */
export type SubmitMessageResult = TopicMessageSubmitResult;

/**
 * Service for managing topics on the Hiero Consensus Service (HCS).
 *
 * Wraps the underlying `TopicCreate*` / `TopicUpdate*` / `TopicDelete*` /
 * `TopicMessageSubmit*` SDK surface with validated, observability-aware
 * operations. Listeners registered on the surrounding `HieroContext` see
 * `before` / `after` events for every topic transaction submitted here.
 *
 * Operations are organised internally into per-transaction classes under
 * `services/topic/operations/`; validators live alongside in
 * `services/topic/validation/`. This facade routes typed option objects
 * to the right operation class so callers never have to think about the
 * SDK transaction class hierarchy.
 */
export class TopicService {
    private readonly createOperation: TopicCreateOperation;
    private readonly updateOperation: TopicUpdateOperation;
    private readonly deleteOperation: TopicDeleteOperation;
    private readonly submitOperation: TopicMessageSubmitOperation;

    constructor(private readonly context: IHieroContext) {
        this.createOperation = new TopicCreateOperation(context);
        this.updateOperation = new TopicUpdateOperation(context);
        this.deleteOperation = new TopicDeleteOperation(context);
        this.submitOperation = new TopicMessageSubmitOperation(context);
    }

    /**
     * Create a new topic.
     *
     * Topics support both public (anyone may submit) and private
     * (`submitKey`-gated) message logs, as well as HIP-991 custom fees.
     * Every field is optional — call with `{}` to create a fully open,
     * immutable, public topic owned by the operator.
     *
     * @param options.topicMemo - Topic-level memo (max 100 bytes)
     * @param options.adminKey - Admin key required to later update or delete the topic
     * @param options.submitKey - Submit key; when set, only signers holding it may submit messages
     * @param options.autoRenewAccountId - Account charged for auto-renewal (required when adminKey is set)
     * @param options.autoRenewPeriod - Auto-renew period in seconds (network bounds apply)
     * @param options.feeScheduleKey - Fee schedule key (HIP-991) for later customFees updates
     * @param options.feeExemptKeys - Keys whose holders are exempt from customFees on submit
     * @param options.customFees - Custom fees charged on each message submission (HIP-991)
     * @returns The topic ID of the newly created topic (e.g., `"0.0.12345"`)
     *
     * @example
     * ```typescript
     * // Public, immutable topic
     * const topicId = await topicService.createTopic({
     *     topicMemo: "audit log",
     * });
     *
     * // Private, mutable topic — only submitKey holders may submit;
     * // adminKey holder may later update / delete it.
     * const adminKey = PrivateKey.generateED25519();
     * const submitKey = PrivateKey.generateED25519();
     * const topicId = await topicService.createTopic({
     *     topicMemo: "private feed",
     *     adminKey: adminKey.publicKey,
     *     submitKey: submitKey.publicKey,
     *     autoRenewAccountId: operatorId,
     *     additionalSigners: [adminKey],
     * });
     * ```
     */
    async createTopic(options: CreateTopicOptions = {}): Promise<string> {
        return await this.createOperation.execute(options);
    }

    /**
     * Schedule a topic creation for deferred multi-sig execution.
     * Returns a `scheduleId` — other parties can then sign through
     * `ScheduleService` before the topic creation executes automatically.
     *
     * @param options - Same fields as `createTopic`
     * @param scheduleOptions.payerAccountId - Override the account that pays for the schedule creation
     * @param scheduleOptions.adminKey - Optional schedule admin key for later updates / deletion
     * @param scheduleOptions.scheduleMemo - Optional memo stored on the schedule itself
     */
    async scheduleCreateTopic(
        options: CreateTopicOptions = {},
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        return await this.createOperation.schedule(options, scheduleOptions);
    }

    /**
     * Update an existing topic.
     *
     * If there is no adminKey, the only authorized update (available to anyone) is to extend the expirationTime.
     * Otherwise transaction must be signed by the adminKey.
     *
     * If an adminKey is updated, the transaction must be signed by the pre-update adminKey and post-update adminKey.
     *
     * If a new autoRenewAccount is specified (not just being removed), that account must also sign the transaction.
     *
     * @param options.topicId - Topic to update (required)
     * @param options.topicMemo - New memo (max 100 bytes), or `null` to clear
     * @param options.adminKey - Replace admin key, or `null` to make immutable
     * @param options.submitKey - Replace submit key, or `null` to make public
     * @param options.autoRenewAccountId - New auto-renew account, or `null` to clear
     * @param options.autoRenewPeriod - New auto-renew period in seconds (not clearable)
     * @param options.feeScheduleKey - Replace fee-schedule key (HIP-991), or `null`
     * @param options.feeExemptKeys - Replace fee-exempt keys (HIP-991), or `null`
     * @param options.customFees - Replace custom fees (HIP-991), or `null`
     * @param options.expirationTime - Extend the topic's expiration (not clearable)
     */
    async updateTopic(options: UpdateTopicOptions): Promise<void> {
        return await this.updateOperation.execute(options);
    }

    /**
     * Delete a topic.
     *
     * No more transactions or queries on the topic will succeed.
     *
     * If an adminKey is set, this transaction must be signed by that key.
     * If there is no adminKey, this transaction will fail with
     * `UNAUTHORIZED`.
     *
     * `TopicDelete` is not whitelisted for scheduling on the network, so
     * no `scheduleDeleteTopic` variant is exposed.
     *
     * @param options.topicId - Topic to delete (required)
     */
    async deleteTopic(options: DeleteTopicOptions): Promise<void> {
        return await this.deleteOperation.execute(options);
    }

    /**
     * Submit a message to a topic.
     *
     * Valid and authorized messages on valid topics will be ordered by
     * the consensus service, gossipped to the mirror nodes, and made
     * available to the requesting all subscribers on this topic through
     * a subscription response. Messages can be at most 1024 bytes per
     * chunk; larger messages are automatically split and submitted in
     * multiple chunks by the SDK (controllable via `maxChunks` /
     * `chunkSize`).
     *
     * If the topic has a `submitKey` then that key MUST sign this
     * transaction — pass it via `additionalSigners`.
     *
     * For HIP-991 topics with `customFees`, the submitter pays unless
     * their key is on `feeExemptKeys`. Use `customFeeLimits` to cap the
     * maximum fee you're willing to pay.
     *
     * @param options.topicId - Topic to submit to (required)
     * @param options.message - Message payload, UTF-8 string or raw bytes (required, non-empty)
     * @param options.maxChunks - Max chunks for auto-splitting (SDK default 20)
     * @param options.chunkSize - Bytes per chunk (SDK default 1024)
     * @param options.customFeeLimits - HIP-991 fee caps the submitter accepts
     * @returns Sequence number, running hash, and transaction ID from the (first chunk's) receipt
     */
    async submitMessage(
        options: SubmitMessageOptions,
    ): Promise<SubmitMessageResult> {
        return await this.submitOperation.execute(options);
    }
}
