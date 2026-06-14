import type { NftAllSerialsAllowanceDeletion } from "../operations/DeleteAllNftAllowancesOperation.js";
import { normalizeError } from "../../../errors/index.js";

/**
 * Validates an array of `NftAllSerialsAllowanceDeletion` entries before
 * building the SDK transaction.
 */
export class DeleteAllNftAllowancesValidator {
    validate(allowances: NftAllSerialsAllowanceDeletion[]): void {
        this.validateAtLeastOneAllowance(allowances);
        this.validateNftAllowances(allowances);
    }

    private validateAtLeastOneAllowance(
        allowances: NftAllSerialsAllowanceDeletion[],
    ): void {
        if (!allowances || allowances.length === 0) {
            throw normalizeError(
                new Error(
                    "nftAllowances must be provided with at least one entry.",
                ),
                "DeleteAllNftAllowancesValidator",
            );
        }
    }

    private validateNftAllowances(
        allowances: NftAllSerialsAllowanceDeletion[],
    ): void {
        for (const allowance of allowances) {
            if (!allowance.tokenId) {
                throw normalizeError(
                    new Error("nftAllowances[].tokenId is required."),
                    "DeleteAllNftAllowancesValidator",
                );
            }

            if (!allowance.ownerAccountId) {
                throw normalizeError(
                    new Error("nftAllowances[].ownerAccountId is required."),
                    "DeleteAllNftAllowancesValidator",
                );
            }

            if (!allowance.spenderAccountId) {
                throw normalizeError(
                    new Error("nftAllowances[].spenderAccountId is required."),
                    "DeleteAllNftAllowancesValidator",
                );
            }
        }
    }
}
