import { normalizeError } from "../../../errors/index.js";
import type { TopicUpdateOperationOptions } from "../operations/index.js";

const MAX_TOPIC_MEMO_BYTES = 100;

/**
 * Validates `TopicUpdateOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 *
 * Enforces:
 *  - `topicId` is present and non-empty.
 *  - A non-cleared `topicMemo` fits the network's 100-byte limit.
 *  - Non-clearable fields (`autoRenewPeriod`, `expirationTime`) reject
 *    `null` explicitly. TypeScript blocks this at compile time, but
 *    JavaScript callers and `any`-typed data can still slip a `null`
 *    through — without this check the SDK would silently ignore the
 *    field and the caller's intent would be lost.
 *
 * Cross-field signing rules (admin-key rotation, autoRenew account
 * changes) are not validated here because they depend on the topic's
 * current network state — the network rejects them with
 * `INVALID_SIGNATURE` if the right `additionalSigners` weren't supplied.
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
        this.validateNonClearableFields(options);
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

    /**
     * Reject `null` on fields the SDK has no `clearX()` for —
     * `autoRenewPeriod` and `expirationTime`. Without this guard a JS
     * caller passing `null` to one of these would have it silently
     * dropped by `build()` instead of triggering the clear they
     * expected.
     */
    private validateNonClearableFields(
        options: TopicUpdateOperationOptions,
    ): void {
        // Read with a deliberately wide cast — TypeScript blocks `null`
        // at compile time, but JS callers / `any` data can still pass it.
        const wide = options as {
            autoRenewPeriod?: unknown;
            expirationTime?: unknown;
        };

        if (wide.autoRenewPeriod === null) {
            throw normalizeError(
                new Error(
                    "autoRenewPeriod cannot be null — this field has no clear operation. Omit it to leave unchanged.",
                ),
                "TopicUpdateValidator",
            );
        }

        if (wide.expirationTime === null) {
            throw normalizeError(
                new Error(
                    "expirationTime cannot be null — this field has no clear operation. Omit it to leave unchanged.",
                ),
                "TopicUpdateValidator",
            );
        }
    }
}
