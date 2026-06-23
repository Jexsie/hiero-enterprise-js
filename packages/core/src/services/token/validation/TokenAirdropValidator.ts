import type BigNumber from "bignumber.js";
import { Long } from "@hiero-ledger/sdk";
import { normalizeError } from "../../../errors/index.js";
import type { TokenAirdropOperationOptions } from "../operations/TokenAirdropOperation.js";

/**
 * Validates `TokenAirdropOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class TokenAirdropValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: TokenAirdropOperationOptions): void {
        this.validateTokenId(options);
        this.validateAccount(options, "senderAccountId");
        this.validateAccount(options, "receiverAccountId");
        this.validateDistinctAccounts(options);
        this.validateAmount(options);
        this.validateExpectedDecimals(options);
    }

    private validateTokenId(options: TokenAirdropOperationOptions): void {
        if (options.tokenId == null) {
            throw normalizeError(
                new Error("tokenId is required."),
                "TokenAirdropValidator",
            );
        }

        if (
            typeof options.tokenId === "string" &&
            options.tokenId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("tokenId cannot be empty."),
                "TokenAirdropValidator",
            );
        }
    }

    private validateAccount(
        options: TokenAirdropOperationOptions,
        field: "senderAccountId" | "receiverAccountId",
    ): void {
        const value = options[field];

        if (value == null) {
            throw normalizeError(
                new Error(`${field} is required.`),
                "TokenAirdropValidator",
            );
        }

        if (typeof value === "string" && value.trim().length === 0) {
            throw normalizeError(
                new Error(`${field} cannot be empty.`),
                "TokenAirdropValidator",
            );
        }
    }

    private validateDistinctAccounts(
        options: TokenAirdropOperationOptions,
    ): void {
        const sender =
            typeof options.senderAccountId === "string"
                ? options.senderAccountId
                : options.senderAccountId.toString();
        const receiver =
            typeof options.receiverAccountId === "string"
                ? options.receiverAccountId
                : options.receiverAccountId.toString();

        if (sender === receiver) {
            throw normalizeError(
                new Error(
                    "senderAccountId and receiverAccountId must be different.",
                ),
                "TokenAirdropValidator",
            );
        }
    }

    private validateAmount(options: TokenAirdropOperationOptions): void {
        if (options.amount == null) {
            throw normalizeError(
                new Error("amount is required."),
                "TokenAirdropValidator",
            );
        }

        let isPositive: boolean;
        if (typeof options.amount === "number") {
            isPositive = options.amount > 0;
        } else if (typeof options.amount === "bigint") {
            isPositive = options.amount > 0n;
        } else if (Long.isLong(options.amount)) {
            isPositive =
                !options.amount.isNegative() && !options.amount.isZero();
        } else {
            // BigNumber
            isPositive = (options.amount as BigNumber).isGreaterThan(0);
        }

        if (!isPositive) {
            throw normalizeError(
                new Error("amount must be a positive value."),
                "TokenAirdropValidator",
            );
        }
    }

    private validateExpectedDecimals(
        options: TokenAirdropOperationOptions,
    ): void {
        if (options.expectedDecimals == null) return;

        if (
            !Number.isInteger(options.expectedDecimals) ||
            options.expectedDecimals < 0
        ) {
            throw normalizeError(
                new Error("expectedDecimals must be a non-negative integer."),
                "TokenAirdropValidator",
            );
        }
    }
}
