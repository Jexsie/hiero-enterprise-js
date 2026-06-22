import { normalizeError } from "../../../errors/index.js";
import type { TokenFreezeOperationOptions } from "../operations/index.js";

/**
 * Validates `TokenFreezeOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenFreezeValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenFreezeOperationOptions): void {
        this.validateTokenId(options);
        this.validateAccountId(options);
    }

    private validateTokenId(options: TokenFreezeOperationOptions): void {
        if (options.tokenId == null) {
            throw normalizeError(
                new Error("tokenId is required."),
                "TokenFreezeValidator",
            );
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("tokenId cannot be empty."),
                "TokenFreezeValidator",
            );
        }
    }

    private validateAccountId(options: TokenFreezeOperationOptions): void {
        if (options.accountId == null) {
            throw normalizeError(
                new Error("accountId is required."),
                "TokenFreezeValidator",
            );
        }

        if (
            typeof options.accountId === "string" &&
            options.accountId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("accountId cannot be empty."),
                "TokenFreezeValidator",
            );
        }
    }
}
