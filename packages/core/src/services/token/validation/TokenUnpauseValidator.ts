import { normalizeError } from "../../../errors/index.js";
import type { TokenUnpauseOperationOptions } from "../operations/TokenUnpauseOperation.js";

/**
 * Validates `TokenUnpauseOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenUnpauseValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenUnpauseOperationOptions): void {
        this.validateTokenId(options);
    }

    private validateTokenId(options: TokenUnpauseOperationOptions): void {
        if (options.tokenId == null) {
            throw normalizeError(
                new Error("tokenId is required."),
                "TokenUnpauseValidator",
            );
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("tokenId cannot be empty."),
                "TokenUnpauseValidator",
            );
        }
    }
}
