import type { NftAllowanceDeletion } from "../operations/DeleteAllowanceOperation.js";
import { normalizeError } from "../../../errors/index.js";

/**
 * Validates an array of `NftAllowanceDeletion` entries before building the
 * SDK transaction.
 */
export class DeleteAllowanceValidator {
    validate(allowances: NftAllowanceDeletion[]): void {
        this.validateAtLeastOneAllowance(allowances);
        this.validateNftAllowances(allowances);
    }

    private validateAtLeastOneAllowance(
        allowances: NftAllowanceDeletion[],
    ): void {
        if (!allowances || allowances.length === 0) {
            throw normalizeError(
                new Error(
                    "nftAllowances must be provided with at least one entry.",
                ),
                "DeleteAllowanceValidator",
            );
        }
    }

    private validateNftAllowances(allowances: NftAllowanceDeletion[]): void {
        for (const allowance of allowances) {
            if (!allowance.tokenId) {
                throw normalizeError(
                    new Error("nftAllowances[].tokenId is required."),
                    "DeleteAllowanceValidator",
                );
            }

            if (!allowance.ownerAccountId) {
                throw normalizeError(
                    new Error("nftAllowances[].ownerAccountId is required."),
                    "DeleteAllowanceValidator",
                );
            }

            if (
                !allowance.serialNumbers ||
                allowance.serialNumbers.length === 0
            ) {
                throw normalizeError(
                    new Error(
                        "nftAllowances[].serialNumbers must contain at least one entry.",
                    ),
                    "DeleteAllowanceValidator",
                );
            }

            for (const serial of allowance.serialNumbers) {
                if (serial <= 0 || !Number.isInteger(serial)) {
                    throw normalizeError(
                        new Error(
                            `nftAllowances[].serialNumbers must be positive integers, got ${serial}.`,
                        ),
                        "DeleteAllowanceValidator",
                    );
                }
            }
        }
    }
}
