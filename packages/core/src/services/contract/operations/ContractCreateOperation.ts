import type BigNumber from "bignumber.js";
import type {
    Key,
    Long,
    Hbar,
    FileId,
    AccountId,
    ContractFunctionParameters,
} from "@hiero-ledger/sdk";
import { ContractCreateTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
    ScheduledResult,
} from "../../transaction/index.js";
import { ContractCreateValidator } from "../validation/index.js";

/**
 * Low-level options for the `ContractCreate` SDK transaction.
 *
 * Mirrors the surface of `ContractCreateTransaction` Callers usually go
 * through `ContractService.createContract`, which exposes a friendlier
 * shape. Use this directly when you need full control over every field.
 *
 * Exactly one of `bytecodeFileId` or `bytecode` must be supplied:
 * - `bytecodeFileId` references bytecode previously uploaded via
 *   `FileService.createFile`. Use this for any contract size.
 * - `bytecode` embeds raw bytecode directly in the transaction (HIP-435).
 *   Limited to ~6KB. For larger bytecode without a pre-uploaded file,
 *   prefer `ContractCreateFlowOperation`, which handles file create + append
 *   + delete automatically.
 *
 * Extends `TransactionOptions` for fees, validity window, additional signers,
 * and scheduling.
 */
export interface ContractCreateOperationOptions extends TransactionOptions {
    /** Pre-uploaded bytecode FileId. Mutually exclusive with `bytecode`. */
    bytecodeFileId?: string | FileId;
    /**
     * Raw bytecode embedded directly in the transaction (HIP-435). Limited
     * to ~6KB. Mutually exclusive with `bytecodeFileId`.
     */
    bytecode?: Uint8Array;
    /** Gas limit for the constructor call. Required. */
    gas: number | Long;
    /** Funds transferred into the new contract account on creation. */
    initialBalance?: number | string | Long | BigNumber | Hbar;
    /**
     * Admin key. Required to later update or delete the contract — without
     * it the contract is immutable.
     */
    adminKey?: Key;
    /** Parameters passed to the contract's constructor. */
    constructorParameters?: Uint8Array | ContractFunctionParameters;
    /** Contract-level memo (max 100 bytes). */
    contractMemo?: string;
    /** Auto-renew period for the contract account, in seconds. */
    autoRenewPeriod?: Long | number;
    /** Account charged for auto-renewal fees instead of the contract itself. */
    autoRenewAccountId?: string | AccountId;
    /** Account this contract stakes to. Mutually exclusive with `stakedNodeId`. */
    stakedAccountId?: string | AccountId;
    /** Node this contract stakes to. Mutually exclusive with `stakedAccountId`. */
    stakedNodeId?: Long | number;
    /** Decline staking reward distribution for this contract. */
    declineStakingReward?: boolean;
    /**
     * Allow this contract to auto-associate up to N tokens (HIP-23). Use
     * `-1` for unlimited (HIP-904).
     */
    maxAutomaticTokenAssociations?: number;
}

export class ContractCreateOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: ContractCreateValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new ContractCreateValidator();
    }

    /** Submit a `ContractCreateTransaction` and return the new contract ID. */
    async execute(options: ContractCreateOperationOptions): Promise<string> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.run(
            tx,
            options,
            {
                type: "ContractCreate",
                serviceName: "ContractService",
                methodName: "createContract",
                timestamp: new Date(),
            },
            (receipt) => receipt.contractId!.toString(),
        );
    }

    /** Schedule a `ContractCreateTransaction` for deferred multi-sig execution. */
    async schedule(
        options: ContractCreateOperationOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.scheduleRun(
            tx,
            options,
            {
                type: "ContractCreate",
                serviceName: "ContractService",
                methodName: "createContract",
                timestamp: new Date(),
            },
            scheduleOptions,
        );
    }

    /**
     * Construct the `ContractCreateTransaction` from the caller-provided options.
     *
     * Only setters for fields that were actually provided are invoked so the
     * SDK defaults remain in effect for omitted options.
     */
    private build(
        options: ContractCreateOperationOptions,
    ): ContractCreateTransaction {
        const tx = new ContractCreateTransaction().setGas(options.gas);

        if (options.bytecodeFileId != null) {
            tx.setBytecodeFileId(options.bytecodeFileId);
        }

        if (options.bytecode != null) {
            tx.setBytecode(options.bytecode);
        }

        if (options.initialBalance != null) {
            tx.setInitialBalance(options.initialBalance);
        }

        if (options.adminKey != null) {
            tx.setAdminKey(options.adminKey);
        }

        if (options.constructorParameters != null) {
            tx.setConstructorParameters(options.constructorParameters);
        }

        if (options.contractMemo != null) {
            tx.setContractMemo(options.contractMemo);
        }

        if (options.autoRenewPeriod != null) {
            tx.setAutoRenewPeriod(options.autoRenewPeriod);
        }

        if (options.autoRenewAccountId != null) {
            tx.setAutoRenewAccountId(options.autoRenewAccountId);
        }

        if (options.stakedAccountId != null) {
            tx.setStakedAccountId(options.stakedAccountId);
        }

        if (options.stakedNodeId != null) {
            tx.setStakedNodeId(options.stakedNodeId);
        }

        if (options.declineStakingReward != null) {
            tx.setDeclineStakingReward(options.declineStakingReward);
        }

        if (options.maxAutomaticTokenAssociations != null) {
            tx.setMaxAutomaticTokenAssociations(
                options.maxAutomaticTokenAssociations,
            );
        }

        return tx;
    }
}
