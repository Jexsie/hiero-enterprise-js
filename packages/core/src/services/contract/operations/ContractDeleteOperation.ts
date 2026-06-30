import type { AccountId, ContractId } from "@hiero-ledger/sdk";
import { ContractDeleteTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
    ScheduledResult,
} from "../../transaction/index.js";
import { ContractDeleteValidator } from "../validation/index.js";

/**
 * Low-level options for the `ContractDelete` SDK transaction.
 *
 * Mirrors the surface of `ContractDeleteTransaction`. Callers usually go
 * through `ContractService.deleteContract`, which exposes a friendlier
 * shape. Use this directly when you need full control over every field.
 *
 * Deleting a contract requires the contract's `adminKey` to sign the
 * transaction — pass it via `additionalSigners`. Contracts deployed
 * without an admin key are immutable and cannot be deleted (the network
 * returns `MODIFYING_IMMUTABLE_CONTRACT`).
 *
 * Exactly one of `transferAccountId` or `transferContractId` is required
 * — the network needs a destination for the contract's remaining HBAR
 * balance.
 *
 * Extends `TransactionOptions` for fees, validity window, additional
 * signers, and scheduling.
 */
export interface ContractDeleteOperationOptions extends TransactionOptions {
    /** Contract to delete. */
    contractId: string | ContractId;
    /**
     * Account that receives the contract's remaining HBAR balance.
     * Mutually exclusive with `transferContractId`. Exactly one is
     * required. If the target account has `receiverSignatureRequired`
     * set, that account must also sign — add its key to
     * `additionalSigners`.
     */
    transferAccountId?: string | AccountId;
    /**
     * Contract that receives the deleted contract's remaining HBAR
     * balance. Mutually exclusive with `transferAccountId`. Exactly one
     * is required.
     */
    transferContractId?: string | ContractId;
}

export class ContractDeleteOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: ContractDeleteValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new ContractDeleteValidator();
    }

    /**
     * Submit a `ContractDeleteTransaction`.
     */
    async execute(options: ContractDeleteOperationOptions): Promise<void> {
        this.validator.validate(options);

        const tx = this.build(options);

        await this.executor.run(
            tx,
            options,
            {
                type: "ContractDelete",
                serviceName: "ContractService",
                methodName: "deleteContract",
                timestamp: new Date(),
            },
            () => undefined,
        );
    }

    /** Schedule a `ContractDeleteTransaction` for deferred multi-sig execution. */
    async schedule(
        options: ContractDeleteOperationOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.scheduleRun(
            tx,
            options,
            {
                type: "ContractDelete",
                serviceName: "ContractService",
                methodName: "deleteContract",
                timestamp: new Date(),
            },
            scheduleOptions,
        );
    }

    /**
     * Construct the `ContractDeleteTransaction` from the caller-provided
     * options. The validator guarantees exactly one transfer target is
     * set, so the build path only needs to dispatch on which one.
     */
    private build(
        options: ContractDeleteOperationOptions,
    ): ContractDeleteTransaction {
        const tx = new ContractDeleteTransaction().setContractId(
            options.contractId,
        );

        if (options.transferAccountId != null) {
            tx.setTransferAccountId(options.transferAccountId);
        }

        if (options.transferContractId != null) {
            tx.setTransferContractId(options.transferContractId);
        }

        return tx;
    }
}
