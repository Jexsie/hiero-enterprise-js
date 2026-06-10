import {
    AccountAllowanceApproveTransaction,
    Hbar,
    TokenId,
    NftId,
    AccountId,
    type TransactionReceipt,
} from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { ApproveAllowanceValidator } from "../validation/index.js";

/**
 * A single HBAR allowance grant: owner approves spender to spend up to `amount`.
 */
export interface HbarAllowanceApproval {
    /** The account granting the allowance (owner). */
    ownerAccountId: string;
    /** The account being granted spending permission. */
    spenderAccountId: string;
    /** Maximum HBAR the spender is allowed to spend. Accepts number (HBAR) or Hbar instance. */
    amount: number | Hbar;
}

/**
 * A single fungible token allowance grant.
 */
export interface TokenAllowanceApproval {
    /** The token ID for this allowance. */
    tokenId: string;
    /** The account granting the allowance (owner). */
    ownerAccountId: string;
    /** The account being granted spending permission. */
    spenderAccountId: string;
    /** Maximum token units the spender is allowed to transfer. */
    amount: number | bigint;
}

/**
 * A single NFT allowance grant — either specific serial numbers or all serials.
 */
export interface NftAllowanceApproval {
    /** The token ID for this NFT collection. */
    tokenId: string;
    /** The account granting the allowance (owner). */
    ownerAccountId: string;
    /** The account being granted transfer permission. */
    spenderAccountId: string;
    /**
     * Specific serial numbers to approve. Mutually exclusive with `allSerials`.
     */
    serialNumbers?: number[];
    /**
     * Approve all current and future serials in this collection.
     * Mutually exclusive with `serialNumbers`.
     */
    allSerials?: boolean;
    /**
     * Optional delegating spender — the account that delegated its
     * approved-for-all permission to this spender for specific serials.
     * Only applies when `serialNumbers` is used; ignored with `allSerials`.
     */
    delegatingSpender?: string;
}

/**
 * Options for approving account allowances on the Hiero network.
 *
 * Allows an owner to grant a spender permission to spend HBAR, fungible tokens,
 * or NFTs on their behalf. Exactly one allowance type must be provided per call.
 *
 * The owner's key must sign the transaction — pass it via `additionalSigners`
 * unless the operator IS the owner.
 */
export interface ApproveAllowanceOptions extends TransactionOptions {
    /** HBAR allowances to approve. */
    hbarAllowances?: HbarAllowanceApproval[];
    /** Fungible token allowances to approve. */
    tokenAllowances?: TokenAllowanceApproval[];
    /** NFT allowances to approve. */
    nftAllowances?: NftAllowanceApproval[];
}

/**
 * Options for the `approveHbarAllowance` convenience method.
 */
export interface ApproveHbarAllowanceOptions extends TransactionOptions {
    /** HBAR allowances to approve. At least one required. */
    hbarAllowances: HbarAllowanceApproval[];
}

/**
 * Options for the `approveTokenAllowance` convenience method.
 */
export interface ApproveTokenAllowanceOptions extends TransactionOptions {
    /** Fungible token allowances to approve. At least one required. */
    tokenAllowances: TokenAllowanceApproval[];
}

/**
 * Options for the `approveNftAllowance` convenience method.
 */
export interface ApproveNftAllowanceOptions extends TransactionOptions {
    /** NFT allowances to approve. At least one required. */
    nftAllowances: NftAllowanceApproval[];
}

export class ApproveAllowanceOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: ApproveAllowanceValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new ApproveAllowanceValidator();
    }

    /** Approve allowances. */
    async execute(
        options: ApproveAllowanceOptions,
        methodName = "approveAllowance",
    ): Promise<TransactionReceipt> {
        this.validator.validate(options);
        const tx = this.build(options);

        return await this.executor.run(
            tx,
            options,
            {
                type: "AccountAllowanceApprove",
                serviceName: "AccountService",
                methodName,
                timestamp: new Date(),
            },

            // TODO: Return something meaningful here
            // I agree the receipt contains useful information
            // but it would be nice to return something more specific
            // to allowance approval, e.g. the list of approved
            // allowances with their status.
            (receipt) => receipt,
        );
    }

    /**
     * Constructs the `AccountAllowanceApproveTransaction` from options.
     */
    private build(
        options: ApproveAllowanceOptions,
    ): AccountAllowanceApproveTransaction {
        const tx = new AccountAllowanceApproveTransaction();

        // HBAR allowances
        for (const allowance of options.hbarAllowances ?? []) {
            const amount =
                allowance.amount instanceof Hbar
                    ? allowance.amount
                    : new Hbar(allowance.amount);
            tx.approveHbarAllowance(
                allowance.ownerAccountId,
                allowance.spenderAccountId,
                amount,
            );
        }

        // Fungible token allowances
        for (const allowance of options.tokenAllowances ?? []) {
            tx.approveTokenAllowance(
                allowance.tokenId,
                allowance.ownerAccountId,
                allowance.spenderAccountId,
                BigInt(allowance.amount),
            );
        }

        // NFT allowances
        for (const allowance of options.nftAllowances ?? []) {
            if (allowance.allSerials) {
                tx.approveTokenNftAllowanceAllSerials(
                    TokenId.fromString(allowance.tokenId),
                    allowance.ownerAccountId,
                    allowance.spenderAccountId,
                );
            } else if (allowance.serialNumbers?.length) {
                for (const serial of allowance.serialNumbers) {
                    const nftId = new NftId(
                        TokenId.fromString(allowance.tokenId),
                        serial,
                    );

                    if (allowance.delegatingSpender) {
                        tx.approveTokenNftAllowanceWithDelegatingSpender(
                            nftId,
                            allowance.ownerAccountId,
                            AccountId.fromString(allowance.spenderAccountId),
                            allowance.delegatingSpender,
                        );
                    } else {
                        tx.approveTokenNftAllowance(
                            nftId,
                            allowance.ownerAccountId,
                            allowance.spenderAccountId,
                        );
                    }
                }
            }
        }

        return tx;
    }
}
