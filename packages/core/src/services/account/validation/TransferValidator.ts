import type { AccountId, TokenId, Hbar } from "@hiero-ledger/sdk";
import { normalizeError } from "../../../errors/index.js";

/**
 * Validates inputs to `TransferOperation` methods before building the SDK
 * transaction.
 *
 * Catches common bugs the network would otherwise reject (or silently accept)
 * — empty IDs, non-positive amounts, non-integer token amounts, and self
 * transfers.
 */
export class TransferValidator {
    validateHbarTransfer(params: {
        receiverAccountId: string | AccountId;
        senderAccountId: string | AccountId;
        amount: number | Hbar;
    }): void {
        this.validateAccountId(params.senderAccountId, "senderAccountId");
        this.validateAccountId(params.receiverAccountId, "receiverAccountId");
        this.validateDistinctAccounts(
            params.senderAccountId,
            params.receiverAccountId,
        );
        this.validateHbarAmount(params.amount);
    }

    validateTokenTransfer(params: {
        tokenId: string | TokenId;
        receiverAccountId: string | AccountId;
        senderAccountId: string | AccountId;
        amount: number;
        expectedDecimals?: number;
    }): void {
        this.validateTokenId(params.tokenId);
        this.validateAccountId(params.senderAccountId, "senderAccountId");
        this.validateAccountId(params.receiverAccountId, "receiverAccountId");
        this.validateDistinctAccounts(
            params.senderAccountId,
            params.receiverAccountId,
        );
        this.validateTokenAmount(params.amount);
        if (params.expectedDecimals !== undefined) {
            this.validateExpectedDecimals(params.expectedDecimals);
        }
    }

    validateNftTransfer(params: {
        tokenId: string | TokenId;
        serial: number;
        receiverAccountId: string | AccountId;
        senderAccountId: string | AccountId;
    }): void {
        this.validateTokenId(params.tokenId);
        this.validateSerial(params.serial);
        this.validateAccountId(params.senderAccountId, "senderAccountId");
        this.validateAccountId(params.receiverAccountId, "receiverAccountId");
        this.validateDistinctAccounts(
            params.senderAccountId,
            params.receiverAccountId,
        );
    }

    private validateAccountId(
        value: string | AccountId | null | undefined,
        paramName: string,
    ): void {
        if (value == null) {
            throw normalizeError(
                new Error(`${paramName} is required.`),
                "TransferValidator",
            );
        }
        if (typeof value === "string" && value.trim() === "") {
            throw normalizeError(
                new Error(`${paramName} must not be empty.`),
                "TransferValidator",
            );
        }
    }

    private validateTokenId(value: string | TokenId | null | undefined): void {
        if (value == null) {
            throw normalizeError(
                new Error("tokenId is required."),
                "TransferValidator",
            );
        }
        if (typeof value === "string" && value.trim() === "") {
            throw normalizeError(
                new Error("tokenId must not be empty."),
                "TransferValidator",
            );
        }
    }

    private validateDistinctAccounts(
        sender: string | AccountId,
        receiver: string | AccountId,
    ): void {
        if (sender.toString() === receiver.toString()) {
            throw normalizeError(
                new Error(
                    "senderAccountId and receiverAccountId must be different — transferring to self is a no-op.",
                ),
                "TransferValidator",
            );
        }
    }

    private validateHbarAmount(amount: number | Hbar | null | undefined): void {
        if (amount == null) {
            throw normalizeError(
                new Error("amount is required."),
                "TransferValidator",
            );
        }

        if (typeof amount === "number") {
            if (!Number.isFinite(amount)) {
                throw normalizeError(
                    new Error("amount must be a finite number."),
                    "TransferValidator",
                );
            }
            if (amount <= 0) {
                throw normalizeError(
                    new Error("amount must be positive."),
                    "TransferValidator",
                );
            }
            return;
        }

        // Hbar instance — compare tinybars via BigInt for precision.
        let tinybars: bigint;
        try {
            tinybars = BigInt(amount.toTinybars().toString());
        } catch {
            throw normalizeError(
                new Error("amount is not a valid Hbar value."),
                "TransferValidator",
            );
        }
        if (tinybars <= 0n) {
            throw normalizeError(
                new Error("amount must be positive."),
                "TransferValidator",
            );
        }
    }

    private validateTokenAmount(amount: number | null | undefined): void {
        if (amount == null) {
            throw normalizeError(
                new Error("amount is required."),
                "TransferValidator",
            );
        }
        if (!Number.isFinite(amount) || !Number.isSafeInteger(amount)) {
            throw normalizeError(
                new Error("amount must be a safe integer."),
                "TransferValidator",
            );
        }
        if (amount <= 0) {
            throw normalizeError(
                new Error("amount must be positive."),
                "TransferValidator",
            );
        }
    }

    private validateSerial(serial: number | null | undefined): void {
        if (serial == null) {
            throw normalizeError(
                new Error("serial is required."),
                "TransferValidator",
            );
        }
        if (!Number.isFinite(serial) || !Number.isSafeInteger(serial)) {
            throw normalizeError(
                new Error("serial must be a safe integer."),
                "TransferValidator",
            );
        }
        if (serial <= 0) {
            throw normalizeError(
                new Error("serial must be positive."),
                "TransferValidator",
            );
        }
    }

    private validateExpectedDecimals(decimals: number): void {
        if (!Number.isFinite(decimals) || !Number.isInteger(decimals)) {
            throw normalizeError(
                new Error("expectedDecimals must be a finite integer."),
                "TransferValidator",
            );
        }
        if (decimals < 0) {
            throw normalizeError(
                new Error("expectedDecimals cannot be negative."),
                "TransferValidator",
            );
        }
    }
}
