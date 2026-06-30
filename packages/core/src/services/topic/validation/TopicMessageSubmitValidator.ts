import { normalizeError } from "../../../errors/index.js";
import type { TopicMessageSubmitOperationOptions } from "../operations/index.js";

/**
 * Validates `TopicMessageSubmitOperationOptions` before they reach the
 * SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 *
 * Enforces:
 *  - `topicId` is present and non-empty.
 *  - `message` is present and non-empty (the network rejects empty
 *    submissions with `INVALID_TOPIC_MESSAGE`, but we catch it locally
 *    for a faster, clearer error).
 *  - `maxChunks` and `chunkSize`, when provided, are positive integers.
 *
 * Signing rules (submitKey, custom-fee payment) are network-enforced —
 * they depend on the topic's current state and the operator's identity,
 * neither of which the validator can see.
 */
export class TopicMessageSubmitValidator {
    /**
     * @throws {HieroError} If validation fails
     */
    validate(options: TopicMessageSubmitOperationOptions): void {
        this.validateTopicId(options);
        this.validateMessage(options);
        this.validateChunkBounds(options);
    }

    private validateTopicId(options: TopicMessageSubmitOperationOptions): void {
        if (options.topicId == null) {
            throw normalizeError(
                new Error("topicId is required."),
                "TopicMessageSubmitValidator",
            );
        }

        if (
            typeof options.topicId === "string" &&
            options.topicId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("topicId cannot be empty."),
                "TopicMessageSubmitValidator",
            );
        }
    }

    private validateMessage(options: TopicMessageSubmitOperationOptions): void {
        if (options.message == null) {
            throw normalizeError(
                new Error("message is required."),
                "TopicMessageSubmitValidator",
            );
        }

        if (typeof options.message === "string") {
            if (options.message.length === 0) {
                throw normalizeError(
                    new Error("message cannot be empty."),
                    "TopicMessageSubmitValidator",
                );
            }
            return;
        }

        if (options.message.byteLength === 0) {
            throw normalizeError(
                new Error("message cannot be empty."),
                "TopicMessageSubmitValidator",
            );
        }
    }

    private validateChunkBounds(
        options: TopicMessageSubmitOperationOptions,
    ): void {
        if (options.maxChunks != null) {
            if (!Number.isInteger(options.maxChunks) || options.maxChunks < 1) {
                throw normalizeError(
                    new Error("maxChunks must be a positive integer."),
                    "TopicMessageSubmitValidator",
                );
            }
        }

        if (options.chunkSize != null) {
            if (!Number.isInteger(options.chunkSize) || options.chunkSize < 1) {
                throw normalizeError(
                    new Error("chunkSize must be a positive integer."),
                    "TopicMessageSubmitValidator",
                );
            }
        }
    }
}
