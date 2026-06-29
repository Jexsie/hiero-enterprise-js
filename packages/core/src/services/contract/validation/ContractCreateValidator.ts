import { Long } from "@hiero-ledger/sdk";
import { normalizeError } from "../../../errors/index.js";
import type { ContractCreateOperationOptions } from "../operations/ContractCreateOperation.js";

const MAX_CONTRACT_MEMO_BYTES = 100;

/**
 * Validates `ContractCreateOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class ContractCreateValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the transaction.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: ContractCreateOperationOptions): void {
        this.validateBytecodeSource(options);
        this.validateGas(options);
        this.validateInitialBalance(options);
        this.validateMemo(options);
        this.validateStakingMutex(options);
    }

    private validateBytecodeSource(
        options: ContractCreateOperationOptions,
    ): void {
        const hasFileId = options.bytecodeFileId != null;
        const hasBytecode = options.bytecode != null;

        if (!hasFileId && !hasBytecode) {
            throw normalizeError(
                new Error(
                    "ContractCreate requires either bytecodeFileId or bytecode.",
                ),
                "ContractCreateValidator",
            );
        }

        if (hasFileId && hasBytecode) {
            throw normalizeError(
                new Error(
                    "ContractCreate accepts bytecodeFileId or bytecode, not both.",
                ),
                "ContractCreateValidator",
            );
        }

        if (hasBytecode && options.bytecode!.length === 0) {
            throw normalizeError(
                new Error("bytecode must not be empty."),
                "ContractCreateValidator",
            );
        }
    }

    private validateGas(options: ContractCreateOperationOptions): void {
        if (options.gas == null) {
            throw normalizeError(
                new Error("gas is required."),
                "ContractCreateValidator",
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
                "ContractCreateValidator",
            );
        }
    }

    private validateInitialBalance(
        options: ContractCreateOperationOptions,
    ): void {
        const value = options.initialBalance;
        if (value == null) return;

        if (typeof value === "number" && value < 0) {
            throw normalizeError(
                new Error("initialBalance must not be negative."),
                "ContractCreateValidator",
            );
        }

        if (typeof value === "bigint" && value < 0n) {
            throw normalizeError(
                new Error("initialBalance must not be negative."),
                "ContractCreateValidator",
            );
        }

        if (Long.isLong(value) && (value as Long).isNegative()) {
            throw normalizeError(
                new Error("initialBalance must not be negative."),
                "ContractCreateValidator",
            );
        }
    }

    private validateMemo(options: ContractCreateOperationOptions): void {
        if (options.contractMemo == null) return;

        const byteLength = Buffer.byteLength(options.contractMemo, "utf8");
        if (byteLength > MAX_CONTRACT_MEMO_BYTES) {
            throw normalizeError(
                new Error(
                    `contractMemo exceeds ${MAX_CONTRACT_MEMO_BYTES} bytes (got ${byteLength}).`,
                ),
                "ContractCreateValidator",
            );
        }
    }

    private validateStakingMutex(
        options: ContractCreateOperationOptions,
    ): void {
        if (options.stakedAccountId != null && options.stakedNodeId != null) {
            throw normalizeError(
                new Error(
                    "Specify either stakedAccountId or stakedNodeId, not both.",
                ),
                "ContractCreateValidator",
            );
        }
    }
}
