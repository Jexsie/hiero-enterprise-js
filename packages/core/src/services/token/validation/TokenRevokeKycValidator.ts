import { normalizeError } from "../../../errors/index.js";
import type { TokenRevokeKycOperationOptions } from "../operations/TokenRevokeKycOperation.js";

/**
 * Validates `TokenRevokeKycOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenRevokeKycValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenRevokeKycOperationOptions): void {
        this.validateTokenId(options);
        this.validateAccountId(options);
    }

    private validateTokenId(options: TokenRevokeKycOperationOptions): void {
        if (options.tokenId == null) {
            throw normalizeError(
                new Error("tokenId is required."),
                "TokenRevokeKycValidator",
            );
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("tokenId cannot be empty."),
                "TokenRevokeKycValidator",
            );
        }
    }

    private validateAccountId(options: TokenRevokeKycOperationOptions): void {
        if (options.accountId == null) {
            throw normalizeError(
                new Error("accountId is required."),
                "TokenRevokeKycValidator",
            );
        }

        if (
            typeof options.accountId === "string" &&
            options.accountId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("accountId cannot be empty."),
                "TokenRevokeKycValidator",
            );
        }
    }
}
