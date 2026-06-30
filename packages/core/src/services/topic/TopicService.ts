import type { IHieroContext } from "../../context/index.js";
import type { ScheduleOptions, ScheduledResult } from "../transaction/index.js";
import { TopicCreateOperation } from "./operations/index.js";
import type { TopicCreateOperationOptions } from "./operations/index.js";

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

    constructor(private readonly context: IHieroContext) {
        this.createOperation = new TopicCreateOperation(context);
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
}
