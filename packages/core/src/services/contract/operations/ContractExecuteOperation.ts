import type BigNumber from "bignumber.js";
import type {
    Long,
    Hbar,
    ContractId,
    ContractFunctionParameters,
} from "@hiero-ledger/sdk";
import { ContractExecuteTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
    ScheduledResult,
} from "../../transaction/index.js";
import { ContractExecuteValidator } from "../validation/index.js";

/**
 * Low-level options for the `ContractExecute` SDK transaction.
 *
 * Mirrors the surface of `ContractExecuteTransaction`. Callers usually
 * go through `ContractService.executeContract`, which exposes a
 * friendlier shape. Use this directly when you need full control over
 * every field.
 *
 * Exactly one call-target form must be supplied:
 * - `functionName` (with optional ABI-typed `functionParameters`) — the
 *   common path; the SDK encodes the call data for you.
 * - `rawFunctionParameters` — pre-encoded ABI bytes for advanced
 *   callers that build call data themselves.
 *
 * Extends `TransactionOptions` for fees, validity window, additional
 * signers, and scheduling.
 */
export interface ContractExecuteOperationOptions extends TransactionOptions {
    /** Contract to invoke. */
    contractId: string | ContractId;
    /** Gas limit for the call. Required. */
    gas: number | Long;
    /**
     * Name of the contract function to invoke. Combined with
     * `functionParameters` (if provided) via `setFunction(name, params)`.
     * Mutually exclusive with `rawFunctionParameters`.
     */
    functionName?: string;
    /**
     * ABI-typed parameters for the function call. Ignored unless
     * `functionName` is also set.
     */
    functionParameters?: ContractFunctionParameters;
    /**
     * Pre-encoded ABI call data (function selector + arguments).
     * Mutually exclusive with `functionName`.
     */
    rawFunctionParameters?: Uint8Array;
    /**
     * HBAR forwarded to the contract with the call (for `payable`
     * functions). Defaults to `0` when omitted.
     */
    payableAmount?: number | string | Long | BigNumber | Hbar | bigint;
}

export class ContractExecuteOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: ContractExecuteValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new ContractExecuteValidator();
    }

    /**
     * Submit a `ContractExecuteTransaction`.
     */
    async execute(options: ContractExecuteOperationOptions): Promise<void> {
        this.validator.validate(options);

        const tx = this.build(options);

        await this.executor.run(
            tx,
            options,
            {
                type: "ContractExecute",
                serviceName: "ContractService",
                methodName: "executeContract",
                timestamp: new Date(),
            },
            () => undefined,
        );
    }

    /** Schedule a `ContractExecuteTransaction` for deferred multi-sig execution. */
    async schedule(
        options: ContractExecuteOperationOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.scheduleRun(
            tx,
            options,
            {
                type: "ContractExecute",
                serviceName: "ContractService",
                methodName: "executeContract",
                timestamp: new Date(),
            },
            scheduleOptions,
        );
    }

    /**
     * Construct the `ContractExecuteTransaction` from the caller-provided
     * options.
     *
     * Only setters for fields that were actually provided are invoked so
     * the SDK defaults remain in effect for omitted options.
     */
    private build(
        options: ContractExecuteOperationOptions,
    ): ContractExecuteTransaction {
        const tx = new ContractExecuteTransaction()
            .setContractId(options.contractId)
            .setGas(options.gas);

        if (options.functionName != null && options.functionName !== "") {
            tx.setFunction(options.functionName, options.functionParameters);
        } else {
            tx.setFunctionParameters(options.rawFunctionParameters!);
        }

        if (options.payableAmount != null) {
            tx.setPayableAmount(options.payableAmount);
        }

        return tx;
    }
}
