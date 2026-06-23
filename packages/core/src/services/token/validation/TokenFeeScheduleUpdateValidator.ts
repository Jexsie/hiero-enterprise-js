import { normalizeError } from "../../../errors/index.js";
import type { TokenFeeScheduleUpdateOperationOptions } from "../operations/TokenFeeScheduleUpdateOperation.js";

/**
 * Validates `TokenFeeScheduleUpdateOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenFeeScheduleUpdateValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenFeeScheduleUpdateOperationOptions): void {
        this.validateTokenId(options);
        this.validateCustomFees(options);
    }

    private validateTokenId(
        options: TokenFeeScheduleUpdateOperationOptions,
    ): void {
        if (options.tokenId == null) {
            throw normalizeError(
                new Error("tokenId is required."),
                "TokenFeeScheduleUpdateValidator",
            );
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("tokenId cannot be empty."),
                "TokenFeeScheduleUpdateValidator",
            );
        }
    }

    private validateCustomFees(
        options: TokenFeeScheduleUpdateOperationOptions,
    ): void {
        if (options.customFees == null) {
            throw normalizeError(
                new Error(
                    "customFees is required. Pass an empty array to clear all custom fees.",
                ),
                "TokenFeeScheduleUpdateValidator",
            );
        }

        if (!Array.isArray(options.customFees)) {
            throw normalizeError(
                new Error("customFees must be an array."),
                "TokenFeeScheduleUpdateValidator",
            );
        }
    }
}
