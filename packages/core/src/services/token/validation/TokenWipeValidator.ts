import type BigNumber from "bignumber.js";
import { Long } from "@hiero-ledger/sdk";
import { normalizeError } from "../../../errors/index.js";
import type { TokenWipeOperationOptions } from "../operations/index.js";

/**
 * Validates `TokenWipeOperationOptions` before they reach the SDK.
 */
export class TokenWipeValidator {
    validate(options: TokenWipeOperationOptions): void {
        this.validateTokenId(options);
        this.validateAccountId(options);
        this.validateSerials(options);
        this.validateAmountOrSerials(options);
        this.validateAmount(options);
    }

    private validateTokenId(options: TokenWipeOperationOptions): void {
        if (options.tokenId == null) {
            throw normalizeError(
                new Error("tokenId is required."),
                "TokenWipeValidator",
            );
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("tokenId cannot be empty."),
                "TokenWipeValidator",
            );
        }
    }

    private validateAccountId(options: TokenWipeOperationOptions): void {
        if (options.accountId == null) {
            throw normalizeError(
                new Error("accountId is required."),
                "TokenWipeValidator",
            );
        }

        if (
            typeof options.accountId === "string" &&
            options.accountId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("accountId cannot be empty."),
                "TokenWipeValidator",
            );
        }
    }

    private validateAmountOrSerials(options: TokenWipeOperationOptions): void {
        const hasAmount = options.amount != null;
        const hasSerials =
            options.serials != null && options.serials.length > 0;

        if (!hasAmount && !hasSerials) {
            throw normalizeError(
                new Error(
                    "Token wipe requires either amount (fungible) or serials (NFT).",
                ),
                "TokenWipeValidator",
            );
        }

        if (hasAmount && hasSerials) {
            throw normalizeError(
                new Error(
                    "Token wipe requires either amount (fungible) or serials (NFT).",
                ),
                "TokenWipeValidator",
            );
        }
    }

    private validateAmount(options: TokenWipeOperationOptions): void {
        if (options.amount == null) return;

        let isNegative;
        if (typeof options.amount === "number") {
            isNegative = options.amount < 0;
        } else if (typeof options.amount === "bigint") {
            isNegative = options.amount < 0n;
        } else if (Long.isLong(options.amount)) {
            isNegative = options.amount.isNegative();
        } else {
            // BigNumber
            isNegative = (options.amount as BigNumber).isNegative();
        }

        if (isNegative) {
            throw normalizeError(
                new Error("amount cannot be negative."),
                "TokenWipeValidator",
            );
        }
    }

    private validateSerials(options: TokenWipeOperationOptions): void {
        if (options.serials == null) return;

        if (!Array.isArray(options.serials)) {
            throw normalizeError(
                new Error("serials must be an array."),
                "TokenWipeValidator",
            );
        }

        if (options.serials.length === 0) {
            throw normalizeError(
                new Error("serials cannot be an empty array."),
                "TokenWipeValidator",
            );
        }

        for (const serial of options.serials) {
            if (serial == null) {
                throw normalizeError(
                    new Error("serials entries cannot be null."),
                    "TokenWipeValidator",
                );
            }

            const isLong = Long.isLong(serial);
            const isNumber = typeof serial === "number";

            if (!isLong && !isNumber) {
                throw normalizeError(
                    new Error("serials entries must be a number or Long."),
                    "TokenWipeValidator",
                );
            }

            if (isNumber && !Number.isInteger(serial)) {
                throw normalizeError(
                    new Error("serials entries must be positive integers."),
                    "TokenWipeValidator",
                );
            }

            const isNonPositive = isLong
                ? serial.isNegative() || serial.isZero()
                : (serial as number) <= 0;

            if (isNonPositive) {
                throw normalizeError(
                    new Error("serials entries must be positive integers."),
                    "TokenWipeValidator",
                );
            }
        }
    }
}
