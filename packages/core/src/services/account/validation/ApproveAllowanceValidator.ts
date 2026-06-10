import type { ApproveAllowanceOptions } from "../operations/ApproveAllowanceOperation.js";
import { normalizeError } from "../../../errors/index.js";

/**
 * Validates `ApproveAllowanceOptions` before building the SDK transaction.
 */
export class ApproveAllowanceValidator {
    validate(options: ApproveAllowanceOptions): void {
        this.validateAtLeastOneAllowance(options);
        this.validateHbarAllowances(options);
        this.validateTokenAllowances(options);
        this.validateNftAllowances(options);
    }

    private validateAtLeastOneAllowance(
        options: ApproveAllowanceOptions,
    ): void {
        const hasHbar = (options.hbarAllowances?.length ?? 0) > 0;
        const hasToken = (options.tokenAllowances?.length ?? 0) > 0;
        const hasNft = (options.nftAllowances?.length ?? 0) > 0;

        if (!hasHbar && !hasToken && !hasNft) {
            throw normalizeError(
                new Error(
                    "At least one allowance must be provided (hbarAllowances, tokenAllowances, or nftAllowances).",
                ),
                "ApproveAllowanceValidator",
            );
        }
    }

    private validateHbarAllowances(options: ApproveAllowanceOptions): void {
        for (const allowance of options.hbarAllowances ?? []) {
            if (!allowance.ownerAccountId) {
                throw normalizeError(
                    new Error("hbarAllowances[].ownerAccountId is required."),
                    "ApproveAllowanceValidator",
                );
            }

            if (!allowance.spenderAccountId) {
                throw normalizeError(
                    new Error("hbarAllowances[].spenderAccountId is required."),
                    "ApproveAllowanceValidator",
                );
            }

            if (allowance.amount == null) {
                throw normalizeError(
                    new Error("hbarAllowances[].amount is required."),
                    "ApproveAllowanceValidator",
                );
            }

            if (typeof allowance.amount === "number" && allowance.amount < 0) {
                throw normalizeError(
                    new Error("hbarAllowances[].amount cannot be negative."),
                    "ApproveAllowanceValidator",
                );
            }
        }
    }

    private validateTokenAllowances(options: ApproveAllowanceOptions): void {
        for (const allowance of options.tokenAllowances ?? []) {
            if (!allowance.tokenId) {
                throw normalizeError(
                    new Error("tokenAllowances[].tokenId is required."),
                    "ApproveAllowanceValidator",
                );
            }

            if (!allowance.ownerAccountId) {
                throw normalizeError(
                    new Error("tokenAllowances[].ownerAccountId is required."),
                    "ApproveAllowanceValidator",
                );
            }

            if (!allowance.spenderAccountId) {
                throw normalizeError(
                    new Error(
                        "tokenAllowances[].spenderAccountId is required.",
                    ),
                    "ApproveAllowanceValidator",
                );
            }

            if (allowance.amount == null) {
                throw normalizeError(
                    new Error("tokenAllowances[].amount is required."),
                    "ApproveAllowanceValidator",
                );
            }

            if (Number(allowance.amount) < 0) {
                throw normalizeError(
                    new Error("tokenAllowances[].amount cannot be negative."),
                    "ApproveAllowanceValidator",
                );
            }

            if (
                typeof allowance.amount === "number" &&
                (!Number.isFinite(allowance.amount) ||
                    !Number.isInteger(allowance.amount))
            ) {
                throw normalizeError(
                    new Error(
                        "tokenAllowances[].amount must be a finite integer.",
                    ),
                    "ApproveAllowanceValidator",
                );
            }
        }
    }

    private validateNftAllowances(options: ApproveAllowanceOptions): void {
        for (const allowance of options.nftAllowances ?? []) {
            if (!allowance.tokenId) {
                throw normalizeError(
                    new Error("nftAllowances[].tokenId is required."),
                    "ApproveAllowanceValidator",
                );
            }

            if (!allowance.ownerAccountId) {
                throw normalizeError(
                    new Error("nftAllowances[].ownerAccountId is required."),
                    "ApproveAllowanceValidator",
                );
            }

            if (!allowance.spenderAccountId) {
                throw normalizeError(
                    new Error("nftAllowances[].spenderAccountId is required."),
                    "ApproveAllowanceValidator",
                );
            }

            const hasSerials =
                allowance.serialNumbers != null &&
                allowance.serialNumbers.length > 0;
            const hasAllSerials = allowance.allSerials === true;

            if (!hasSerials && !hasAllSerials) {
                throw normalizeError(
                    new Error(
                        "nftAllowances[] must specify either serialNumbers or allSerials: true.",
                    ),
                    "ApproveAllowanceValidator",
                );
            }

            if (hasSerials && hasAllSerials) {
                throw normalizeError(
                    new Error(
                        "nftAllowances[].serialNumbers and allSerials are mutually exclusive.",
                    ),
                    "ApproveAllowanceValidator",
                );
            }

            if (hasSerials) {
                for (const serial of allowance.serialNumbers!) {
                    if (serial <= 0 || !Number.isInteger(serial)) {
                        throw normalizeError(
                            new Error(
                                `nftAllowances[].serialNumbers must be positive integers, got ${serial}.`,
                            ),
                            "ApproveAllowanceValidator",
                        );
                    }
                }
            }
        }
    }
}
