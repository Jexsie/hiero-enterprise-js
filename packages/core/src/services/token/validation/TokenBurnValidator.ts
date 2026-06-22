import type BigNumber from "bignumber.js";
import { Long } from "@hiero-ledger/sdk";
import { normalizeError } from "../../../errors/index.js";
import type { TokenBurnOperationOptions } from "../operations/index.js";

/**
 * Validates `TokenBurnOperationOptions` before they reach the SDK.
 */
export class TokenBurnValidator {
    validate(options: TokenBurnOperationOptions): void {
        this.validateTokenId(options);
        this.validateSerials(options);
        this.validateAmountOrSerials(options);
        this.validateAmount(options);
    }

    private validateTokenId(options: TokenBurnOperationOptions): void {
        if (options.tokenId == null) {
            throw normalizeError(
                new Error("tokenId is required."),
                "TokenBurnValidator",
            );
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("tokenId cannot be empty."),
                "TokenBurnValidator",
            );
        }
    }

    private validateAmountOrSerials(options: TokenBurnOperationOptions): void {
        const hasAmount = options.amount != null;
        const hasSerials =
            options.serials != null && options.serials.length > 0;

        if (!hasAmount && !hasSerials) {
            throw normalizeError(
                new Error(
                    "Token burn requires either amount (fungible) or serials (NFT).",
                ),
                "TokenBurnValidator",
            );
        }

        if (hasAmount && hasSerials) {
            throw normalizeError(
                new Error(
                    "Token burn requires either amount (fungible) or serials (NFT).",
                ),
                "TokenBurnValidator",
            );
        }
    }

    private validateAmount(options: TokenBurnOperationOptions): void {
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
                "TokenBurnValidator",
            );
        }
    }

    private validateSerials(options: TokenBurnOperationOptions): void {
        if (options.serials == null) return;

        if (!Array.isArray(options.serials)) {
            throw normalizeError(
                new Error("serials must be an array."),
                "TokenBurnValidator",
            );
        }

        if (options.serials.length === 0) {
            throw normalizeError(
                new Error("serials cannot be an empty array."),
                "TokenBurnValidator",
            );
        }

        for (const serial of options.serials) {
            if (serial == null) {
                throw normalizeError(
                    new Error("serials entries cannot be null."),
                    "TokenBurnValidator",
                );
            }

            const isLong = Long.isLong(serial);
            const isNumber = typeof serial === "number";

            if (!isLong && !isNumber) {
                throw normalizeError(
                    new Error("serials entries must be a number or Long."),
                    "TokenBurnValidator",
                );
            }

            if (isNumber && !Number.isInteger(serial)) {
                throw normalizeError(
                    new Error("serials entries must be positive integers."),
                    "TokenBurnValidator",
                );
            }

            const isNonPositive = isLong
                ? serial.isNegative() || serial.isZero()
                : (serial as number) <= 0;

            if (isNonPositive) {
                throw normalizeError(
                    new Error("serials entries must be positive integers."),
                    "TokenBurnValidator",
                );
            }
        }
    }
}
