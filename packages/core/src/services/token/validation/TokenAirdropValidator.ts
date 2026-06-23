import type BigNumber from "bignumber.js";
import { Long } from "@hiero-ledger/sdk";
import { normalizeError } from "../../../errors/index.js";
import type {
    TokenAirdropOperationOptions,
    TokenAirdrop,
} from "../operations/TokenAirdropOperation.js";

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
        this.validateAirdropsList(options);
        options.airdrops.forEach((airdrop, index) => {
            this.validateAirdrop(airdrop, index);
        });
    }

    private validateAirdropsList(options: TokenAirdropOperationOptions): void {
        if (options.airdrops == null) {
            throw normalizeError(
                new Error("airdrops is required."),
                "TokenAirdropValidator",
            );
        }

        if (!Array.isArray(options.airdrops)) {
            throw normalizeError(
                new Error("airdrops must be an array."),
                "TokenAirdropValidator",
            );
        }

        if (options.airdrops.length === 0) {
            throw normalizeError(
                new Error("airdrops must not be empty."),
                "TokenAirdropValidator",
            );
        }
    }

    private validateAirdrop(airdrop: TokenAirdrop, index: number): void {
        const prefix = `airdrops[${index}]`;
        this.validateTokenId(airdrop, prefix);
        this.validateAccount(airdrop, "senderAccountId", prefix);
        this.validateAccount(airdrop, "receiverAccountId", prefix);
        this.validateDistinctAccounts(airdrop, prefix);
        this.validateAmount(airdrop, prefix);
        this.validateExpectedDecimals(airdrop, prefix);
    }

    private validateTokenId(airdrop: TokenAirdrop, prefix: string): void {
        if (airdrop.tokenId == null) {
            throw normalizeError(
                new Error(`${prefix}.tokenId is required.`),
                "TokenAirdropValidator",
            );
        }

        if (
            typeof airdrop.tokenId === "string" &&
            airdrop.tokenId.trim().length === 0
        ) {
            throw normalizeError(
                new Error(`${prefix}.tokenId cannot be empty.`),
                "TokenAirdropValidator",
            );
        }
    }

    private validateAccount(
        airdrop: TokenAirdrop,
        field: "senderAccountId" | "receiverAccountId",
        prefix: string,
    ): void {
        const value = airdrop[field];

        if (value == null) {
            throw normalizeError(
                new Error(`${prefix}.${field} is required.`),
                "TokenAirdropValidator",
            );
        }

        if (typeof value === "string" && value.trim().length === 0) {
            throw normalizeError(
                new Error(`${prefix}.${field} cannot be empty.`),
                "TokenAirdropValidator",
            );
        }
    }

    private validateDistinctAccounts(
        airdrop: TokenAirdrop,
        prefix: string,
    ): void {
        const sender =
            typeof airdrop.senderAccountId === "string"
                ? airdrop.senderAccountId
                : airdrop.senderAccountId.toString();
        const receiver =
            typeof airdrop.receiverAccountId === "string"
                ? airdrop.receiverAccountId
                : airdrop.receiverAccountId.toString();

        if (sender === receiver) {
            throw normalizeError(
                new Error(
                    `${prefix}: senderAccountId and receiverAccountId must be different.`,
                ),
                "TokenAirdropValidator",
            );
        }
    }

    private validateAmount(airdrop: TokenAirdrop, prefix: string): void {
        if (airdrop.amount == null) {
            throw normalizeError(
                new Error(`${prefix}.amount is required.`),
                "TokenAirdropValidator",
            );
        }

        let isPositive: boolean;
        if (typeof airdrop.amount === "number") {
            isPositive = airdrop.amount > 0;
        } else if (typeof airdrop.amount === "bigint") {
            isPositive = airdrop.amount > 0n;
        } else if (Long.isLong(airdrop.amount)) {
            isPositive =
                !airdrop.amount.isNegative() && !airdrop.amount.isZero();
        } else {
            // BigNumber
            isPositive = (airdrop.amount as BigNumber).isGreaterThan(0);
        }

        if (!isPositive) {
            throw normalizeError(
                new Error(`${prefix}.amount must be a positive value.`),
                "TokenAirdropValidator",
            );
        }
    }

    private validateExpectedDecimals(
        airdrop: TokenAirdrop,
        prefix: string,
    ): void {
        if (airdrop.expectedDecimals == null) return;

        if (
            !Number.isInteger(airdrop.expectedDecimals) ||
            airdrop.expectedDecimals < 0
        ) {
            throw normalizeError(
                new Error(
                    `${prefix}.expectedDecimals must be a non-negative integer.`,
                ),
                "TokenAirdropValidator",
            );
        }
    }
}
