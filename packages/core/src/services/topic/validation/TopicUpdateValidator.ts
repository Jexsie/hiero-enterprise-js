import { normalizeError } from "../../../errors/index.js";
import type { TopicUpdateOperationOptions } from "../operations/index.js";

const MAX_TOPIC_MEMO_BYTES = 100;

/**
 * Validates `TopicUpdateOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 *
 * Only enforces what the SDK does not surface synchronously: a topic ID
 * is required and a non-cleared memo must fit the network's 100-byte
 * limit. Cross-field signing rules (admin-key rotation, autoRenew
 * account changes) are not validated here because they depend on the
 * topic's current network state — the network rejects them with
 * `INVALID_SIGNATURE` if the right `additionalSigners` weren't
 * supplied.
 */
export class TopicUpdateValidator {
    /**
     * Validate the caller-provided options prior to building or
     * submitting the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TopicUpdateOperationOptions): void {
        this.validateTopicId(options);
        this.validateMemo(options);
    }

    private validateTopicId(options: TopicUpdateOperationOptions): void {
        if (options.topicId == null) {
            throw normalizeError(
                new Error("topicId is required."),
                "TopicUpdateValidator",
            );
        }

        if (
            typeof options.topicId === "string" &&
            options.topicId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("topicId cannot be empty."),
                "TopicUpdateValidator",
            );
        }
    }

    private validateMemo(options: TopicUpdateOperationOptions): void {
        // `null` clears the memo on the network — no length check needed.
        if (options.topicMemo == null) return;

        const byteLength = Buffer.byteLength(options.topicMemo, "utf8");
        if (byteLength > MAX_TOPIC_MEMO_BYTES) {
            throw normalizeError(
                new Error(
                    `topicMemo exceeds ${MAX_TOPIC_MEMO_BYTES} bytes (got ${byteLength}).`,
                ),
                "TopicUpdateValidator",
            );
        }
    }
}
