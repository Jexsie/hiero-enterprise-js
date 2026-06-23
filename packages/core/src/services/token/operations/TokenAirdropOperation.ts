import type BigNumber from "bignumber.js";
import type { AccountId, TokenId } from "@hiero-ledger/sdk";
import { Long, TokenAirdropTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { TokenAirdropValidator } from "../validation/index.js";

/**
 * Low-level options for the `TokenAirdropTransaction` SDK transaction.
 *
 * Models a single-sender / single-receiver fungible airdrop. Behaviour
 * depends on the receiver's association state:
 *
 * - Already associated: tokens are credited immediately.
 * - Has free auto-association slots: token is auto-associated and credited.
 * - Receiver-sig-required or no auto-association slots: a "Pending
 *   Airdrop" is created that the receiver can later claim.
 *
 * The transaction payer (operator) covers all transfer, association,
 * association-renewal, airdrop, and custom fees. The sender account's
 * key must sign — supply it via `additionalSigners`.
 *
 * Extends `TransactionOptions` for fees, validity window, and additional
 * signers. Note: `TokenAirdrop` is not whitelisted for scheduling on the
 * network, so no `schedule()` variant is exposed.
 */
export interface TokenAirdropOperationOptions extends TransactionOptions {
    tokenId: TokenId | string;
    senderAccountId: AccountId | string;
    receiverAccountId: AccountId | string;
    amount: Long | number | BigNumber | bigint;
    /**
     * Optional decimal-precision check. When provided, the network rejects
     * the transaction unless the token's decimals match this value —
     * guards against accidentally airdropping amounts in the wrong
     * denomination.
     */
    expectedDecimals?: number;
}

export class TokenAirdropOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: TokenAirdropValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new TokenAirdropValidator();
    }

    /** Submit a `TokenAirdropTransaction`. */
    async execute(options: TokenAirdropOperationOptions): Promise<void> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.run(
            tx,
            options,
            {
                type: "TokenAirdrop",
                serviceName: "TokenService",
                methodName: "airdropFungibleToken",
                timestamp: new Date(),
            },
            () => undefined,
        );
    }

    private build(
        options: TokenAirdropOperationOptions,
    ): TokenAirdropTransaction {
        const positive = Long.fromString(options.amount.toString());
        const negative = positive.negate();

        const tx = new TokenAirdropTransaction();

        if (options.expectedDecimals != null) {
            tx.addTokenTransferWithDecimals(
                options.tokenId,
                options.senderAccountId,
                negative,
                options.expectedDecimals,
            ).addTokenTransferWithDecimals(
                options.tokenId,
                options.receiverAccountId,
                positive,
                options.expectedDecimals,
            );
        } else {
            tx.addTokenTransfer(
                options.tokenId,
                options.senderAccountId,
                negative,
            ).addTokenTransfer(
                options.tokenId,
                options.receiverAccountId,
                positive,
            );
        }

        return tx;
    }
}
