import { normalizeError } from "../../../errors/index.js";
import type { TokenUpdateOperationOptions } from "../operations/TokenUpdateOperation.js";

const MAX_TOKEN_NAME_BYTES = 100;
const MAX_TOKEN_SYMBOL_BYTES = 100;
const MAX_TOKEN_MEMO_BYTES = 100;

/**
 * Validates `TokenUpdateOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenUpdateValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenUpdateOperationOptions): void {
        this.validateTokenId(options);
        this.validateName(options);
        this.validateSymbol(options);
        this.validateMemo(options);
        this.validateTreasury(options);
        this.validateAutoRenewAccount(options);
    }

    private validateTokenId(options: TokenUpdateOperationOptions): void {
        if (options.tokenId == null) {
            throw normalizeError(
                new Error("tokenId is required."),
                "TokenUpdateValidator",
            );
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("tokenId cannot be empty."),
                "TokenUpdateValidator",
            );
        }
    }

    private validateName(options: TokenUpdateOperationOptions): void {
        if (options.tokenName == null) return;

        if (options.tokenName.length === 0) {
            throw normalizeError(
                new Error("tokenName cannot be empty."),
                "TokenUpdateValidator",
            );
        }

        const byteLength = Buffer.byteLength(options.tokenName, "utf8");
        if (byteLength > MAX_TOKEN_NAME_BYTES) {
            throw normalizeError(
                new Error(
                    `tokenName exceeds ${MAX_TOKEN_NAME_BYTES} bytes (got ${byteLength}).`,
                ),
                "TokenUpdateValidator",
            );
        }
    }

    private validateSymbol(options: TokenUpdateOperationOptions): void {
        if (options.tokenSymbol == null) return;

        if (options.tokenSymbol.length === 0) {
            throw normalizeError(
                new Error("tokenSymbol cannot be empty."),
                "TokenUpdateValidator",
            );
        }

        const byteLength = Buffer.byteLength(options.tokenSymbol, "utf8");
        if (byteLength > MAX_TOKEN_SYMBOL_BYTES) {
            throw normalizeError(
                new Error(
                    `tokenSymbol exceeds ${MAX_TOKEN_SYMBOL_BYTES} bytes (got ${byteLength}).`,
                ),
                "TokenUpdateValidator",
            );
        }
    }

    private validateMemo(options: TokenUpdateOperationOptions): void {
        if (options.tokenMemo == null) return;

        const byteLength = Buffer.byteLength(options.tokenMemo, "utf8");
        if (byteLength > MAX_TOKEN_MEMO_BYTES) {
            throw normalizeError(
                new Error(
                    `tokenMemo exceeds ${MAX_TOKEN_MEMO_BYTES} bytes (got ${byteLength}).`,
                ),
                "TokenUpdateValidator",
            );
        }
    }

    private validateTreasury(options: TokenUpdateOperationOptions): void {
        if (options.treasuryAccountId == null) return;

        if (
            typeof options.treasuryAccountId === "string" &&
            options.treasuryAccountId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("treasuryAccountId cannot be empty."),
                "TokenUpdateValidator",
            );
        }
    }

    private validateAutoRenewAccount(
        options: TokenUpdateOperationOptions,
    ): void {
        if (options.autoRenewAccountId == null) return;

        if (
            typeof options.autoRenewAccountId === "string" &&
            options.autoRenewAccountId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("autoRenewAccountId cannot be empty."),
                "TokenUpdateValidator",
            );
        }
    }
}
