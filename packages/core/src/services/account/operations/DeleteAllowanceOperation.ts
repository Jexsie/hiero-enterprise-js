import {
    AccountAllowanceDeleteTransaction,
    TokenId,
    NftId,
    type TransactionReceipt,
} from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { DeleteAllowanceValidator } from "../validation/index.js";

/**
 * A single NFT allowance deletion — removes the spender's approval for
 * the specified serial numbers of an NFT collection owned by `ownerAccountId`.
 *
 * Note: The Hiero protocol only supports per-serial NFT allowance deletion via
 * `AccountAllowanceDeleteTransaction`. To remove HBAR or fungible token
 * allowances, set the amount to `0` using `approveHbarAllowance` /
 * `approveTokenAllowance`. To remove an "approve for all serials" grant,
 * use `AccountAllowanceApproveTransaction.deleteTokenNftAllowanceAllSerials`.
 */
export interface NftAllowanceDeletion {
    /** The token ID for this NFT collection. */
    tokenId: string;
    /** The account that originally granted the allowance (owner). */
    ownerAccountId: string;
    /** Specific serial numbers to revoke. Must contain at least one entry. */
    serialNumbers: number[];
}

/**
 * Options for deleting NFT allowances on the Hiero network.
 *
 * The owner's key must sign the transaction — pass it via `additionalSigners`
 * unless the operator IS the owner.
 */
export type DeleteAllowanceOptions = TransactionOptions;

export class DeleteAllowanceOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: DeleteAllowanceValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new DeleteAllowanceValidator();
    }

    /** Delete NFT allowances. */
    async execute(
        allowances: NftAllowanceDeletion[],
        options: DeleteAllowanceOptions = {},
        methodName = "deleteNftAllowance",
    ): Promise<TransactionReceipt> {
        this.validator.validate(allowances);
        const tx = this.build(allowances);

        return await this.executor.run(
            tx,
            options,
            {
                type: "AccountAllowanceDelete",
                serviceName: "AccountService",
                methodName,
                timestamp: new Date(),
            },
            (receipt) => receipt,
        );
    }

    /**
     * Constructs the `AccountAllowanceDeleteTransaction` from allowances.
     */
    private build(
        allowances: NftAllowanceDeletion[],
    ): AccountAllowanceDeleteTransaction {
        const tx = new AccountAllowanceDeleteTransaction();

        for (const allowance of allowances) {
            for (const serial of allowance.serialNumbers) {
                const nftId = new NftId(
                    TokenId.fromString(allowance.tokenId),
                    serial,
                );
                tx.deleteAllTokenNftAllowances(nftId, allowance.ownerAccountId);
            }
        }

        return tx;
    }
}
