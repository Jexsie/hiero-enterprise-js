import type { IHieroContext } from "../../context/index.js";
import type { ScheduleOptions, ScheduledResult } from "../transaction/index.js";
import {
    TopicCreateOperation,
    TopicUpdateOperation,
} from "./operations/index.js";
import type {
    TopicCreateOperationOptions,
    TopicUpdateOperationOptions,
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

    constructor(private readonly context: IHieroContext) {
        this.createOperation = new TopicCreateOperation(context);
        this.updateOperation = new TopicUpdateOperation(context);
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
     * Every field except `topicId` is optional. Optional fields fall
     * into two groups:
     *
     * **Clearable fields** — three-state semantics:
     *  - omitted (`undefined`) → leave unchanged
     *  - `null`                → clear on the network
     *  - value                 → replace existing value
     *
     * Clearable: `topicMemo`, `adminKey`, `submitKey`,
     * `autoRenewAccountId`, `feeScheduleKey`, `feeExemptKeys`,
     * `customFees`.
     *
     * **Non-clearable fields** — two-state semantics:
     *  - omitted (`undefined`) → leave unchanged
     *  - value                 → replace existing value
     *
     * Non-clearable: `autoRenewPeriod`, `expirationTime`.
     *
     * Signing rules (enforced by the network):
     *
     *  - A topic without an `adminKey` is mutable only via
     *    `expirationTime` extension. Every other change requires the
     *    existing admin key to sign — pass it via `additionalSigners`.
     *  - Rotating the `adminKey` requires signatures from BOTH the old
     *    and the new admin keys.
     *  - Switching to a new `autoRenewAccountId` (not just clearing it)
     *    requires that account's signature as well.
     *
     * `TopicUpdate` is **not whitelisted for scheduling** on the
     * network, so no `scheduleUpdateTopic` variant is exposed.
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
     *
     * @example
     * ```typescript
     * // Rename a topic
     * await topicService.updateTopic({
     *     topicId: "0.0.12345",
     *     topicMemo: "renamed feed",
     *     additionalSigners: [adminKey],
     * });
     *
     * // Make a previously-private topic public by clearing the submit key
     * await topicService.updateTopic({
     *     topicId: "0.0.12345",
     *     submitKey: null,
     *     additionalSigners: [adminKey],
     * });
     *
     * // Rotate the admin key — BOTH old and new keys must sign
     * const newAdmin = PrivateKey.generateED25519();
     * await topicService.updateTopic({
     *     topicId: "0.0.12345",
     *     adminKey: newAdmin.publicKey,
     *     additionalSigners: [oldAdmin, newAdmin],
     * });
     * ```
     */
    async updateTopic(options: UpdateTopicOptions): Promise<void> {
        return await this.updateOperation.execute(options);
    }
}
