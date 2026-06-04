import type { PrivateKey, ScheduleId } from "@hiero-ledger/sdk";
import { ScheduleDeleteTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";

/**
 * Options for cancelling a pending scheduled transaction.
 *
 * Requires the `adminKey` that was set when the schedule was originally
 * created via `ScheduleCreateTransaction.setAdminKey()`. Without an admin
 * key the schedule is immutable and cannot be deleted.
 */
export interface ScheduleCancelOptions extends TransactionOptions {
    /** The ID of the schedule entity to cancel. */
    scheduleId: string | ScheduleId;
    /**
     * Private key matching the `adminKey` set at schedule creation time.
     * Automatically added as the first signer before the operator auto-sign.
     */
    adminKey: PrivateKey;
}

export class ScheduleCancelOperation {
    private readonly executor: TransactionExecutor;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
    }

    /** Schedule cancel execute handler. */
    async execute(options: ScheduleCancelOptions): Promise<void> {
        // adminKey must co-sign the ScheduleDeleteTransaction — prepend it so
        // the executor freezes and signs before the operator auto-sign
        const opts: ScheduleCancelOptions = {
            ...options,
            additionalSigners: [
                options.adminKey,
                ...(options.additionalSigners ?? []),
            ],
        };
        const tx = new ScheduleDeleteTransaction().setScheduleId(
            options.scheduleId,
        );
        return this.executor.run(
            tx,
            opts,
            {
                type: "ScheduleDelete",
                serviceName: "ScheduleService",
                methodName: "cancel",
                timestamp: new Date(),
            },

            // TODO: return a more meaningful result here.
            () => undefined,
        );
    }
}
