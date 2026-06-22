import { normalizeError } from "../../../errors/index.js";
import type { TokenDissociateOperationOptions } from "../operations/index.js";

/**
 * Validates `TokenDissociateOperationOptions` before they reach the SDK.
 */
export class TokenDissociateValidator {
    validate(options: TokenDissociateOperationOptions): void {
        this.validateAccountId(options);
        this.validateTokenIds(options);
    }

    private validateAccountId(options: TokenDissociateOperationOptions): void {
        if (options.accountId == null) {
            throw normalizeError(
                new Error("accountId is required."),
                "TokenDissociateValidator",
            );
        }

        if (
            typeof options.accountId === "string" &&
            options.accountId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("accountId cannot be empty."),
                "TokenDissociateValidator",
            );
        }
    }

    private validateTokenIds(options: TokenDissociateOperationOptions): void {
        if (options.tokenIds == null) {
            throw normalizeError(
                new Error("tokenIds is required."),
                "TokenDissociateValidator",
            );
        }

        if (!Array.isArray(options.tokenIds)) {
            throw normalizeError(
                new Error("tokenIds must be an array."),
                "TokenDissociateValidator",
            );
        }

        if (options.tokenIds.length === 0) {
            throw normalizeError(
                new Error("tokenIds must contain at least one token id."),
                "TokenDissociateValidator",
            );
        }

        for (const tokenId of options.tokenIds) {
            if (tokenId == null) {
                throw normalizeError(
                    new Error("tokenIds entries cannot be null."),
                    "TokenDissociateValidator",
                );
            }

            if (typeof tokenId === "string" && tokenId.trim().length === 0) {
                throw normalizeError(
                    new Error("tokenIds entries cannot be empty."),
                    "TokenDissociateValidator",
                );
            }
        }
    }
}
