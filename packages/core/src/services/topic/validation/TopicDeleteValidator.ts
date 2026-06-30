import { normalizeError } from "../../../errors/index.js";
import type { TopicDeleteOperationOptions } from "../operations/index.js";

/**
 * Validates `TopicDeleteOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TopicDeleteValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TopicDeleteOperationOptions): void {
        this.validateTopicId(options);
    }

    private validateTopicId(options: TopicDeleteOperationOptions): void {
        if (options.topicId == null) {
            throw normalizeError(
                new Error("topicId is required."),
                "TopicDeleteValidator",
            );
        }

        if (
            typeof options.topicId === "string" &&
            options.topicId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("topicId cannot be empty."),
                "TopicDeleteValidator",
            );
        }
    }
}
