import type BigNumber from "bignumber.js";
import type { AccountId, TokenId } from "@hiero-ledger/sdk";
import { Long, TokenAirdropTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { TokenAirdropValidator } from "../validation/index.js";

/**
 * A single fungible airdrop entry: tokens move from `senderAccountId`
 * to `receiverAccountId` in the given `amount` (smallest units).
 *
 * Multiple airdrops can be batched into a single `TokenAirdropTransaction`
 * — they may span different tokens, senders, and receivers.
 */
export interface TokenAirdrop {
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

/**
 * Low-level options for the `TokenAirdropTransaction` SDK transaction.
 *
 * Bundles one or more fungible airdrops into a single transaction.
 * Behaviour per receiver depends on its association state:
 *
 * - Already associated: tokens are credited immediately.
 * - Has free auto-association slots: token is auto-associated and credited.
 * - Receiver-sig-required or no auto-association slots: a "Pending
 *   Airdrop" is created that the receiver can later claim.
 *
 * The transaction payer (operator) covers all transfer, association,
 * association-renewal, airdrop, and custom fees. Every distinct sender
 * account's key must sign — supply them via `additionalSigners`.
 *
 * Extends `TransactionOptions` for fees, validity window, and additional
 * signers. Note: `TokenAirdrop` is not whitelisted for scheduling on the
 * network, so no `schedule()` variant is exposed.
 */
export interface TokenAirdropOperationOptions extends TransactionOptions {
    airdrops: TokenAirdrop[];
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
        const tx = new TokenAirdropTransaction();

        for (const airdrop of options.airdrops) {
            const positive = Long.fromString(airdrop.amount.toString());
            const negative = positive.negate();

            if (airdrop.expectedDecimals != null) {
                tx.addTokenTransferWithDecimals(
                    airdrop.tokenId,
                    airdrop.senderAccountId,
                    negative,
                    airdrop.expectedDecimals,
                ).addTokenTransferWithDecimals(
                    airdrop.tokenId,
                    airdrop.receiverAccountId,
                    positive,
                    airdrop.expectedDecimals,
                );
            } else {
                tx.addTokenTransfer(
                    airdrop.tokenId,
                    airdrop.senderAccountId,
                    negative,
                ).addTokenTransfer(
                    airdrop.tokenId,
                    airdrop.receiverAccountId,
                    positive,
                );
            }
        }

        return tx;
    }
}
