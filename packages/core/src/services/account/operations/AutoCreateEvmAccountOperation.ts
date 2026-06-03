import { AccountId, Hbar, TransferTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import type { TransactionEvent } from "../../../listeners/index.js";
import { normalizeError } from "../../../errors/index.js";

export class AutoCreateEvmAccountOperation {
    constructor(private readonly context: IHieroContext) {}

    /** Auto-create EVM account execute handler. */
    async execute(evmAddress: string, amount: number | Hbar): Promise<void> {
        const event: TransactionEvent = {
            type: "AccountAutoCreate",
            serviceName: "AccountService",
            methodName: "autoCreateEvmAccount",
            timestamp: new Date(),
        };
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const hbarAmount =
                amount instanceof Hbar ? amount : new Hbar(amount);

            const transferTx = new TransferTransaction()
                .addHbarTransfer(
                    this.context.operatorAccountId,
                    hbarAmount.negated(),
                )
                .addHbarTransfer(
                    AccountId.fromEvmAddress(0, 0, evmAddress),
                    hbarAmount,
                );

            const response = await transferTx.execute(this.context.client);
            const receipt = await response.getReceipt(this.context.client);

            await this.context.emitAfterTransaction({
                ...event,
                transactionId: response.transactionId.toString(),
                status: receipt.status.toString(),
                durationMs: Date.now() - start,
            });
        } catch (error) {
            await this.context.emitAfterTransaction({
                ...event,
                error:
                    error instanceof Error ? error : new Error(String(error)),
                durationMs: Date.now() - start,
            });
            throw normalizeError(error, "AccountService.autoCreateEvmAccount");
        }
    }
}
