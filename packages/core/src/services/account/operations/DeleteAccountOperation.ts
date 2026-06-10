import type { PrivateKey, AccountId } from "@hiero-ledger/sdk";
import { AccountDeleteTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
    ScheduledResult,
} from "../../transaction/index.js";

/**
 * Options for deleting an account and sweeping its remaining balance.
 *
 * Extends `TransactionOptions` for full control over fees, validity window,
 * additional signers, and scheduling.
 */
export interface DeleteAccountOptions extends TransactionOptions {
    /** The account to delete. */
    accountId: string | AccountId;
    /**
     * Private key of the account being deleted — required to authorize deletion.
     * Automatically added as the first signer before the operator auto-sign.
     */
    accountKey: PrivateKey;
    /**
     * Account that receives the remaining balance after deletion.
     * Defaults to the operator account if not provided.
     */
    transferAccountId?: string | AccountId;
}

/**
 * Options for scheduling an account deletion.
 * `accountKey` is omitted — the account owner signs later via
 * `ScheduleSignTransaction` once the schedule is on-chain.
 */
export type ScheduleDeleteAccountOptions = Omit<
    DeleteAccountOptions,
    "accountKey"
>;

export class DeleteAccountOperation {
    private readonly executor: TransactionExecutor;

    constructor(private readonly context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
    }

    /** Delete account execute handler. */
    async execute(options: DeleteAccountOptions): Promise<void> {
        // Prepend accountKey so it signs the tx before the operator auto-sign
        const opts: DeleteAccountOptions = {
            ...options,
            additionalSigners: [
                options.accountKey,
                ...(options.additionalSigners ?? []),
            ],
        };
        return await this.executor.run(
            this.build(options),
            opts,
            {
                type: "AccountDelete",
                serviceName: "AccountService",
                methodName: "deleteAccount",
                timestamp: new Date(),
            },
            () => undefined,
        );
    }

    /**
     * Schedule account deletion instead of executing immediately.
     *
     * The account owner's signature is collected later via
     * `ScheduleSignTransaction` — no `accountKey` is needed at scheduling time.
     */
    async schedule(
        options: ScheduleDeleteAccountOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        return await this.executor.scheduleRun(
            this.build(options),
            options,
            {
                type: "AccountDelete",
                serviceName: "AccountService",
                methodName: "deleteAccount",
                timestamp: new Date(),
            },
            scheduleOptions,
        );
    }

    /**
     * Constructs the `AccountDeleteTransaction` from the provided options.
     * Pure — no network calls, no side effects.
     */
    private build(
        options: ScheduleDeleteAccountOptions,
    ): AccountDeleteTransaction {
        const transferTo =
            options.transferAccountId ??
            this.context.operatorAccountId.toString();

        return new AccountDeleteTransaction()
            .setAccountId(options.accountId)
            .setTransferAccountId(transferTo);
    }
}
