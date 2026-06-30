import { normalizeError } from "../../../errors/index.js";
import type { ContractUpdateOperationOptions } from "../operations/ContractUpdateOperation.js";

const MAX_CONTRACT_MEMO_BYTES = 100;

/**
 * Validates `ContractUpdateOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class ContractUpdateValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: ContractUpdateOperationOptions): void {
        this.validateContractId(options);
        this.validateMemo(options);
        this.validateStakingMutex(options);
        this.validateMaxAutomaticTokenAssociations(options);
    }

    private validateContractId(options: ContractUpdateOperationOptions): void {
        if (options.contractId == null) {
            throw normalizeError(
                new Error("contractId is required."),
                "ContractUpdateValidator",
            );
        }

        if (
            typeof options.contractId === "string" &&
            options.contractId.trim().length === 0
        ) {
            throw normalizeError(
                new Error("contractId cannot be empty."),
                "ContractUpdateValidator",
            );
        }
    }

    private validateMemo(options: ContractUpdateOperationOptions): void {
        if (options.contractMemo == null) return;

        const byteLength = Buffer.byteLength(options.contractMemo, "utf8");
        if (byteLength > MAX_CONTRACT_MEMO_BYTES) {
            throw normalizeError(
                new Error(
                    `contractMemo exceeds ${MAX_CONTRACT_MEMO_BYTES} bytes (got ${byteLength}).`,
                ),
                "ContractUpdateValidator",
            );
        }
    }

    private validateStakingMutex(
        options: ContractUpdateOperationOptions,
    ): void {
        if (options.stakedAccountId != null && options.stakedNodeId != null) {
            throw normalizeError(
                new Error(
                    "Specify either stakedAccountId or stakedNodeId, not both.",
                ),
                "ContractUpdateValidator",
            );
        }
    }

    /**
     * `maxAutomaticTokenAssociations` accepts `-1` (HIP-904 — unlimited)
     * or any non-negative integer. Anything else is rejected before the
     * SDK serializes a value the network will refuse.
     */
    private validateMaxAutomaticTokenAssociations(
        options: ContractUpdateOperationOptions,
    ): void {
        const value = options.maxAutomaticTokenAssociations;
        if (value == null) return;

        if (!Number.isInteger(value)) {
            throw normalizeError(
                new Error("maxAutomaticTokenAssociations must be an integer."),
                "ContractUpdateValidator",
            );
        }

        if (value < -1) {
            throw normalizeError(
                new Error(
                    "maxAutomaticTokenAssociations must be -1 (unlimited) or a non-negative integer.",
                ),
                "ContractUpdateValidator",
            );
        }
    }
}
