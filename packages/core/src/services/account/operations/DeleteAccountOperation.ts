import type { PrivateKey, AccountId } from "@hiero-ledger/sdk";
import { AccountDeleteTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import type { TransactionEvent } from "../../../listeners/index.js";
import { normalizeError } from "../../../errors/index.js";

export class DeleteAccountOperation {
    constructor(private readonly context: IHieroContext) {}

    /** Delete account execute handler. */
    async execute(
        accountId: string | AccountId,
        accountKey: PrivateKey,
        transferAccountId?: string | AccountId,
    ): Promise<void> {
        const event: TransactionEvent = {
            type: "AccountDelete",
            serviceName: "AccountService",
            methodName: "deleteAccount",
            timestamp: new Date(),
        };
        await this.context.emitBeforeTransaction(event);
        const start = Date.now();

        try {
            const transferTo =
                transferAccountId ?? this.context.operatorAccountId.toString();

            const tx = new AccountDeleteTransaction()
                .setAccountId(accountId)
                .setTransferAccountId(transferTo)
                .freezeWith(this.context.client);

            const response = await (
                await tx.sign(accountKey)
            ).execute(this.context.client);

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
            throw normalizeError(error, "AccountService.deleteAccount");
        }
    }
}
