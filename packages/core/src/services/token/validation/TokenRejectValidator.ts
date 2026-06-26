import { normalizeError } from "../../../errors/index.js";
import type { TokenRejectOperationOptions } from "../operations/index.js";

/**
 * Validates `TokenRejectOperationOptions` before they reach the SDK.
 */
export class TokenRejectValidator {
    validate(options: TokenRejectOperationOptions): void {
        this.validateOwnerId(options);
        this.validateFungibleTokenIds(options);
        this.validateNftIds(options);
        this.validateAtLeastOneTarget(options);
    }

    private validateOwnerId(options: TokenRejectOperationOptions): void {
        if (options.ownerId == null) {
            throw normalizeError(
                new Error("ownerId is required."),
                "TokenRejectValidator",
            );
        }

        if (
            typeof options.ownerId === "string" &&
            options.ownerId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("ownerId cannot be empty."),
                "TokenRejectValidator",
            );
        }
    }

    private validateFungibleTokenIds(
        options: TokenRejectOperationOptions,
    ): void {
        if (options.fungibleTokenIds == null) return;

        if (!Array.isArray(options.fungibleTokenIds)) {
            throw normalizeError(
                new Error("fungibleTokenIds must be an array."),
                "TokenRejectValidator",
            );
        }

        for (const tokenId of options.fungibleTokenIds) {
            if (tokenId == null) {
                throw normalizeError(
                    new Error("fungibleTokenIds entries cannot be null."),
                    "TokenRejectValidator",
                );
            }

            if (typeof tokenId === "string" && tokenId.trim().length === 0) {
                throw normalizeError(
                    new Error("fungibleTokenIds entries cannot be empty."),
                    "TokenRejectValidator",
                );
            }
        }
    }

    private validateNftIds(options: TokenRejectOperationOptions): void {
        if (options.nftIds == null) return;

        if (!Array.isArray(options.nftIds)) {
            throw normalizeError(
                new Error("nftIds must be an array."),
                "TokenRejectValidator",
            );
        }

        for (const nftId of options.nftIds) {
            if (nftId == null) {
                throw normalizeError(
                    new Error("nftIds entries cannot be null."),
                    "TokenRejectValidator",
                );
            }
        }
    }

    private validateAtLeastOneTarget(
        options: TokenRejectOperationOptions,
    ): void {
        const hasTokens =
            options.fungibleTokenIds != null &&
            options.fungibleTokenIds.length > 0;
        const hasNfts = options.nftIds != null && options.nftIds.length > 0;

        if (!hasTokens && !hasNfts) {
            throw normalizeError(
                new Error(
                    "Token reject requires at least one fungibleTokenId or nftId.",
                ),
                "TokenRejectValidator",
            );
        }
    }
}
