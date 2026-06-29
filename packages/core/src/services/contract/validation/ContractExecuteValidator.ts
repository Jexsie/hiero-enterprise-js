import { Long, Hbar } from "@hiero-ledger/sdk";
import { normalizeError } from "../../../errors/index.js";
import type { ContractExecuteOperationOptions } from "../operations/index.js";

/**
 * Validates `ContractExecuteOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class ContractExecuteValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: ContractExecuteOperationOptions): void {
        this.validateContractId(options);
        this.validateGas(options);
        this.validateCallTarget(options);
        this.validatePayableAmount(options);
    }

    private validateContractId(options: ContractExecuteOperationOptions): void {
        if (options.contractId == null || options.contractId === "") {
            throw normalizeError(
                new Error("contractId is required."),
                "ContractExecuteValidator",
            );
        }
    }

    private validateGas(options: ContractExecuteOperationOptions): void {
        if (options.gas == null) {
            throw normalizeError(
                new Error("gas is required."),
                "ContractExecuteValidator",
            );
        }

        const isPositive =
            typeof options.gas === "number"
                ? options.gas > 0
                : Long.isLong(options.gas)
                  ? (options.gas as Long).greaterThan(0)
                  : true;

        if (!isPositive) {
            throw normalizeError(
                new Error("gas must be greater than zero."),
                "ContractExecuteValidator",
            );
        }
    }

    /**
     * Exactly one call-target form must be supplied:
     * - `functionName` (with optional ABI-typed `functionParameters`), OR
     * - `rawFunctionParameters` (pre-encoded ABI bytes).
     *
     * Mixing them is ambiguous (the SDK's `setFunction` and
     * `setFunctionParameters` would overwrite each other).
     */
    private validateCallTarget(options: ContractExecuteOperationOptions): void {
        const hasFunctionName =
            options.functionName != null && options.functionName !== "";
        const hasRawParameters = options.rawFunctionParameters != null;

        if (!hasFunctionName && !hasRawParameters) {
            throw normalizeError(
                new Error(
                    "ContractExecute requires either functionName or rawFunctionParameters.",
                ),
                "ContractExecuteValidator",
            );
        }

        if (hasFunctionName && hasRawParameters) {
            throw normalizeError(
                new Error(
                    "ContractExecute accepts functionName or rawFunctionParameters, not both.",
                ),
                "ContractExecuteValidator",
            );
        }

        if (hasRawParameters && options.rawFunctionParameters!.length === 0) {
            throw normalizeError(
                new Error("rawFunctionParameters must not be empty."),
                "ContractExecuteValidator",
            );
        }
    }

    private validatePayableAmount(
        options: ContractExecuteOperationOptions,
    ): void {
        const value = options.payableAmount;
        if (value == null) return;

        if (typeof value === "number" && value < 0) {
            throw normalizeError(
                new Error("payableAmount must not be negative."),
                "ContractExecuteValidator",
            );
        }

        if (typeof value === "bigint" && value < 0n) {
            throw normalizeError(
                new Error("payableAmount must not be negative."),
                "ContractExecuteValidator",
            );
        }

        if (Long.isLong(value) && (value as Long).isNegative()) {
            throw normalizeError(
                new Error("payableAmount must not be negative."),
                "ContractExecuteValidator",
            );
        }

        if (value instanceof Hbar && value.isNegative()) {
            throw normalizeError(
                new Error("payableAmount must not be negative."),
                "ContractExecuteValidator",
            );
        }
    }
}
