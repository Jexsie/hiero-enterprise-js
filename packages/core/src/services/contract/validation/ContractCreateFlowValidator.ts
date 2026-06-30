import type BigNumber from "bignumber.js";
import { Long, Hbar } from "@hiero-ledger/sdk";
import { normalizeError } from "../../../errors/index.js";
import type { ContractCreateFlowOperationOptions } from "../operations/index.js";

const MAX_CONTRACT_MEMO_BYTES = 100;

/**
 * Validates `ContractCreateFlowOperationOptions` before they reach the SDK.
 *
 * Separated from the operation so validation logic is independently
 * testable without requiring network interaction.
 */
export class ContractCreateFlowValidator {
    /**
     * Validate the caller-provided options prior to building or submitting
     * the flow.
     *
     * @throws {HieroError} If validation fails
     */
    validate(options: ContractCreateFlowOperationOptions): void {
        this.validateBytecode(options);
        this.validateGas(options);
        this.validateInitialBalance(options);
        this.validateMemo(options);
        this.validateStakingMutex(options);
        this.validateMaxChunks(options);
    }

    private validateBytecode(
        options: ContractCreateFlowOperationOptions,
    ): void {
        if (options.bytecode == null) {
            throw normalizeError(
                new Error("bytecode is required."),
                "ContractCreateFlowValidator",
            );
        }

        const len =
            typeof options.bytecode === "string"
                ? options.bytecode.length
                : options.bytecode.byteLength;

        if (len === 0) {
            throw normalizeError(
                new Error("bytecode must not be empty."),
                "ContractCreateFlowValidator",
            );
        }
    }

    private validateGas(options: ContractCreateFlowOperationOptions): void {
        if (options.gas == null) {
            throw normalizeError(
                new Error("gas is required."),
                "ContractCreateFlowValidator",
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
                "ContractCreateFlowValidator",
            );
        }
    }

    private validateInitialBalance(
        options: ContractCreateFlowOperationOptions,
    ): void {
        const value = options.initialBalance;
        if (value == null) return;

        let isNegative;
        if (typeof value === "number") {
            isNegative = value < 0;
        } else if (typeof value === "bigint") {
            isNegative = value < 0n;
        } else if (typeof value === "string") {
            isNegative = parseFloat(value) < 0;
        } else if (Long.isLong(value)) {
            isNegative = (value as Long).isNegative();
        } else if (value instanceof Hbar) {
            isNegative = value.isNegative();
        } else {
            isNegative = (value as BigNumber).isNegative();
        }

        if (isNegative) {
            throw normalizeError(
                new Error("initialBalance must not be negative."),
                "ContractCreateFlowValidator",
            );
        }
    }

    private validateMemo(options: ContractCreateFlowOperationOptions): void {
        if (options.contractMemo == null) return;

        const byteLength = Buffer.byteLength(options.contractMemo, "utf8");
        if (byteLength > MAX_CONTRACT_MEMO_BYTES) {
            throw normalizeError(
                new Error(
                    `contractMemo exceeds ${MAX_CONTRACT_MEMO_BYTES} bytes (got ${byteLength}).`,
                ),
                "ContractCreateFlowValidator",
            );
        }
    }

    private validateStakingMutex(
        options: ContractCreateFlowOperationOptions,
    ): void {
        if (options.stakedAccountId != null && options.stakedNodeId != null) {
            throw normalizeError(
                new Error(
                    "Specify either stakedAccountId or stakedNodeId, not both.",
                ),
                "ContractCreateFlowValidator",
            );
        }
    }

    private validateMaxChunks(
        options: ContractCreateFlowOperationOptions,
    ): void {
        const value = options.maxChunks;
        if (value == null) return;

        if (!Number.isInteger(value) || value <= 0) {
            throw normalizeError(
                new Error("maxChunks must be a positive integer."),
                "ContractCreateFlowValidator",
            );
        }
    }
}
