import { normalizeError } from "../../../errors/index.js";
import type { TokenUpdateNftsOperationOptions } from "../operations/TokenUpdateNftsOperation.js";

/**
 * Validates `TokenUpdateNftsOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenUpdateNftsValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenUpdateNftsOperationOptions): void {
        this.validateTokenId(options);
        this.validateSerialNumbers(options);
        this.validateMetadata(options);
    }

    private validateTokenId(options: TokenUpdateNftsOperationOptions): void {
        if (options.tokenId == null) {
            throw normalizeError(
                new Error("tokenId is required."),
                "TokenUpdateNftsValidator",
            );
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("tokenId cannot be empty."),
                "TokenUpdateNftsValidator",
            );
        }
    }

    private validateSerialNumbers(
        options: TokenUpdateNftsOperationOptions,
    ): void {
        if (options.serialNumbers == null) {
            throw normalizeError(
                new Error("serialNumbers is required."),
                "TokenUpdateNftsValidator",
            );
        }

        if (!Array.isArray(options.serialNumbers)) {
            throw normalizeError(
                new Error("serialNumbers must be an array."),
                "TokenUpdateNftsValidator",
            );
        }

        if (options.serialNumbers.length === 0) {
            throw normalizeError(
                new Error("serialNumbers must not be empty."),
                "TokenUpdateNftsValidator",
            );
        }

        options.serialNumbers.forEach((serial, index) => {
            if (serial == null) {
                throw normalizeError(
                    new Error(`serialNumbers[${index}] is required.`),
                    "TokenUpdateNftsValidator",
                );
            }
        });
    }

    private validateMetadata(options: TokenUpdateNftsOperationOptions): void {
        if (options.metadata == null) {
            throw normalizeError(
                new Error("metadata is required."),
                "TokenUpdateNftsValidator",
            );
        }

        if (!(options.metadata instanceof Uint8Array)) {
            throw normalizeError(
                new Error("metadata must be a Uint8Array."),
                "TokenUpdateNftsValidator",
            );
        }

        if (options.metadata.length === 0) {
            throw normalizeError(
                new Error("metadata cannot be empty."),
                "TokenUpdateNftsValidator",
            );
        }
    }
}
