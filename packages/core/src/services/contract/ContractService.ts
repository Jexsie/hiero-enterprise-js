import type { IHieroContext } from "../../context/index.js";
import type { ScheduleOptions, ScheduledResult } from "../transaction/index.js";
import {
    ContractCreateOperation,
    ContractExecuteOperation,
} from "./operations/index.js";
import type {
    ContractCreateOperationOptions,
    ContractExecuteOperationOptions,
} from "./operations/index.js";

/**
 * Options for deploying a smart contract via `ContractCreateTransaction`.
 *
 * Pass exactly one bytecode source:
 * - `bytecodeFileId` — references bytecode previously uploaded via
 *   `FileService.createFile`. Works for any contract size.
 * - `bytecode` — embeds raw bytecode directly in the transaction (HIP-435).
 *   Limited to ~6KB; for larger contracts without a pre-uploaded file use a
 *   `ContractCreateFlow`-backed operation instead.
 */
export type CreateContractOptions = ContractCreateOperationOptions;

/**
 * Options for invoking a state-mutating contract function via
 * `ContractExecuteTransaction`.
 *
 * Pass exactly one call-target form:
 * - `functionName` (with optional ABI-typed `functionParameters`) — common path;
 *   the SDK encodes the call data.
 * - `rawFunctionParameters` — pre-encoded ABI bytes for advanced callers.
 *
 * For read-only state queries, use `ContractCallQuery` instead (cheaper —
 * no consensus round-trip, no gas charged on success).
 */
export type ExecuteContractOptions = ContractExecuteOperationOptions;

/**
 * Service for managing smart contracts on the Hiero network (HSCS — the
 * Smart Contract Service).
 *
 * Wraps the underlying `ContractCreateTransaction` /
 * `ContractExecuteTransaction` / `ContractCallQuery` / `ContractUpdateTransaction`
 * / `ContractDeleteTransaction` / `ContractInfoQuery` / `ContractBytecodeQuery`
 * SDK surface with validated, observability-aware operations. Listeners
 * registered on the surrounding `HieroContext` see `before` / `after` events
 * for every contract transaction submitted here.
 *
 * Operations are organised internally into per-transaction classes under
 * `services/contract/operations/` (write) and `services/contract/queries/`
 * (read); validators live alongside them in `services/contract/validation/`.
 * This facade routes typed option objects to the right operation class so
 * callers never have to think about the SDK transaction class hierarchy.
 */
export class ContractService {
    private readonly createOperation: ContractCreateOperation;
    private readonly executeOperation: ContractExecuteOperation;

    constructor(private readonly context: IHieroContext) {
        this.createOperation = new ContractCreateOperation(context);
        this.executeOperation = new ContractExecuteOperation(context);
    }

    /**
     * Deploy a new smart contract.
     *
     * Exactly one of `bytecodeFileId` or `bytecode` must be supplied. See
     * `CreateContractOptions` for the trade-offs between the two paths.
     *
     * @param options.bytecodeFileId - FileId of previously uploaded bytecode
     * @param options.bytecode - Raw bytecode bytes embedded in-transaction (HIP-435, ~6KB max)
     * @param options.gas - Gas limit for the constructor call (required)
     * @param options.initialBalance - Funds transferred into the contract on creation
     * @param options.adminKey - Admin key required to later update / delete the contract
     * @param options.constructorParameters - Parameters passed to the contract's constructor
     * @param options.contractMemo - Memo stored on the contract entity (max 100 bytes)
     * @param options.autoRenewPeriod - Auto-renew period for the contract account
     * @param options.autoRenewAccountId - Account charged for auto-renewal fees
     * @param options.stakedAccountId - Account this contract stakes to (mutex with `stakedNodeId`)
     * @param options.stakedNodeId - Node this contract stakes to (mutex with `stakedAccountId`)
     * @param options.declineStakingReward - Decline staking reward distribution
     * @param options.maxAutomaticTokenAssociations - Allow auto-associating up to N tokens (HIP-23 / HIP-904)
     * @returns The contract ID of the deployed contract (e.g., `"0.0.12345"`)
     *
     * @example
     * ```typescript
     * const fileId = await fileService.createFile(bytecode);
     * const contractId = await contractService.createContract({
     *     bytecodeFileId: fileId,
     *     gas: 150_000,
     *     adminKey: adminKey.publicKey,
     *     additionalSigners: [adminKey],
     * });
     * ```
     */
    async createContract(options: CreateContractOptions): Promise<string> {
        return await this.createOperation.execute(options);
    }

    /**
     * Schedule a contract creation for deferred multi-sig execution.
     * Returns a `scheduleId` — other parties can then sign through
     * `ScheduleService` before the contract creation executes automatically.
     *
     * @param options - Same fields as `createContract`
     * @param scheduleOptions.payerAccountId - Override the account that pays for the schedule creation
     * @param scheduleOptions.adminKey - Optional schedule admin key for later updates / deletion
     * @param scheduleOptions.scheduleMemo - Optional memo stored on the schedule itself
     */
    async scheduleCreateContract(
        options: CreateContractOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        return await this.createOperation.schedule(options, scheduleOptions);
    }

    /**
     * Invoke a state-mutating function on a deployed smart contract.
     *
     * Resolves once the consensus node returns a successful receipt for
     * the call. Returns nothing — the contract ID is already known to the
     * caller, and per-call status / timing is delivered through the
     * `before` / `after` listener events on the surrounding `HieroContext`.
     *
     * The call's return bytes, gas used, and logs live on the transaction
     * record (a separate paid query). Fetch the record directly via the
     * SDK if your caller needs them.
     *
     * For read-only state queries that don't mutate the ledger, prefer a
     * `ContractCallQuery` — no consensus round-trip, no gas charged on
     * success.
     *
     * @param options.contractId - Contract to invoke
     * @param options.gas - Gas limit for the call (required)
     * @param options.functionName - Function name to call; SDK encodes parameters
     * @param options.functionParameters - ABI-typed parameters (paired with `functionName`)
     * @param options.rawFunctionParameters - Pre-encoded ABI bytes (mutex with `functionName`)
     * @param options.payableAmount - HBAR forwarded with the call (for `payable` functions)
     *
     * @example
     * ```typescript
     * await contractService.executeContract({
     *     contractId: "0.0.12345",
     *     gas: 100_000,
     *     functionName: "set",
     *     functionParameters: new ContractFunctionParameters().addUint256(42),
     * });
     * ```
     */
    async executeContract(options: ExecuteContractOptions): Promise<void> {
        await this.executeOperation.execute(options);
    }

    /**
     * Schedule a contract execution for deferred multi-sig execution.
     * Returns a `scheduleId` — other parties can then sign through
     * `ScheduleService` before the call executes automatically.
     *
     * @param options - Same fields as `executeContract`
     * @param scheduleOptions.payerAccountId - Override the account that pays for the schedule creation
     * @param scheduleOptions.adminKey - Optional schedule admin key for later updates / deletion
     * @param scheduleOptions.scheduleMemo - Optional memo stored on the schedule itself
     */
    async scheduleExecuteContract(
        options: ExecuteContractOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        return await this.executeOperation.schedule(options, scheduleOptions);
    }
}
