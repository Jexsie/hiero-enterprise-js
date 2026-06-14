import {
    AccountAllowanceApproveTransaction,
    TokenId,
    type TransactionReceipt,
} from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { DeleteAllNftAllowancesValidator } from "../validation/index.js";

/**
 * A single "approve-for-all-serials" NFT allowance revocation — removes the
 * spender's blanket approval for an entire NFT collection owned by
 * `ownerAccountId`.
 *
 * Use this when you previously granted `allSerials: true` via
 * `approveNftAllowance` and want to revoke that blanket grant. For revoking
 * specific serial numbers, use `deleteNftAllowance` instead.
 */
export interface NftAllSerialsAllowanceDeletion {
    /** The token ID for this NFT collection. */
    tokenId: string;
    /** The account that originally granted the allowance (owner). */
    ownerAccountId: string;
    /** The spender whose blanket approval is being revoked. */
    spenderAccountId: string;
}

/**
 * Options for deleting "approve-for-all-serials" NFT allowances on the Hiero
 * network.
 *
 * The owner's key must sign the transaction — pass it via `additionalSigners`
 * unless the operator IS the owner.
 */
export type DeleteAllNftAllowancesOptions = TransactionOptions;

export class DeleteAllNftAllowancesOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: DeleteAllNftAllowancesValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new DeleteAllNftAllowancesValidator();
    }

    /** Delete approve-for-all-serials NFT allowances. */
    async execute(
        allowances: NftAllSerialsAllowanceDeletion[],
        options: DeleteAllNftAllowancesOptions = {},
        methodName = "deleteAllTokenNftAllowances",
    ): Promise<TransactionReceipt> {
        this.validator.validate(allowances);
        const tx = this.build(allowances);

        return await this.executor.run(
            tx,
            options,
            {
                type: "AccountAllowanceApprove",
                serviceName: "AccountService",
                methodName,
                timestamp: new Date(),
            },
            (receipt) => receipt,
        );
    }

    /**
     * Constructs the `AccountAllowanceApproveTransaction` from allowances. The
     * approve transaction is reused because the protocol routes
     * approve-for-all-serials deletions through the same message type.
     */
    private build(
        allowances: NftAllSerialsAllowanceDeletion[],
    ): AccountAllowanceApproveTransaction {
        const tx = new AccountAllowanceApproveTransaction();

        for (const allowance of allowances) {
            tx.deleteTokenNftAllowanceAllSerials(
                TokenId.fromString(allowance.tokenId),
                allowance.ownerAccountId,
                allowance.spenderAccountId,
            );
        }

        return tx;
    }
}
