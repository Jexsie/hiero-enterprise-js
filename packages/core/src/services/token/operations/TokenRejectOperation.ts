import type { NftId, TokenId } from "@hiero-ledger/sdk";
import {
    AccountId,
    TokenDissociateTransaction,
    TokenRejectTransaction,
} from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { TokenRejectValidator } from "../validation/index.js";

/**
 * Low-level options for rejecting tokens from an owner account.
 *
 * Mirrors the surface of the SDK's `TokenRejectFlow`: a single owner
 * rejects one or more fungible tokens and / or NFT serials, returning
 * them to each token's treasury, then is dissociated from those same
 * tokens. At least one of `fungibleTokenIds` or `nftIds` must be
 * supplied; both may be supplied together.
 *
 * Extends `TransactionOptions`, so `additionalSigners` (e.g. the
 * owner's private key), `transactionMemo`, `maxTransactionFee`, etc.
 * are honored on both inner transactions.
 */
export interface TokenRejectOperationOptions extends TransactionOptions {
    ownerId: AccountId | string;
    fungibleTokenIds?: (TokenId | string)[];
    nftIds?: NftId[];
}

/**
 * Two-step reject-and-dissociate operation.
 *
 * Submits a `TokenRejectTransaction` followed by a
 * `TokenDissociateTransaction` for the same set of tokens — the same
 * shape as the SDK's `TokenRejectFlow`, but each step is driven through
 * `TransactionExecutor` so it picks up base `TransactionOptions`
 * (memo / fees / signers) and emits its own before/after events.
 */
export class TokenRejectOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: TokenRejectValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new TokenRejectValidator();
    }

    async execute(options: TokenRejectOperationOptions): Promise<void> {
        this.validator.validate(options);

        const rejectTx = this.buildRejectTransaction(options);

        await this.executor.run(
            rejectTx,
            options,
            {
                type: "TokenReject",
                serviceName: "TokenService",
                methodName: "rejectTokens",
                timestamp: new Date(),
            },
            () => undefined,
        );

        const dissociateTx = this.buildDissociateTransaction(options);

        await this.executor.run(
            dissociateTx,
            options,
            {
                type: "TokenDissociate",
                serviceName: "TokenService",
                methodName: "rejectTokens",
                timestamp: new Date(),
            },
            () => undefined,
        );
    }

    private buildRejectTransaction(
        options: TokenRejectOperationOptions,
    ): TokenRejectTransaction {
        // TokenRejectTransaction.setOwnerId stores its argument as-is —
        // convert strings up front so the protobuf body serializes.
        const ownerId =
            typeof options.ownerId === "string"
                ? AccountId.fromString(options.ownerId)
                : options.ownerId;

        const tx = new TokenRejectTransaction().setOwnerId(ownerId);

        if (
            options.fungibleTokenIds != null &&
            options.fungibleTokenIds.length > 0
        ) {
            tx.setTokenIds(options.fungibleTokenIds as TokenId[]);
        }

        if (options.nftIds != null && options.nftIds.length > 0) {
            tx.setNftIds(options.nftIds);
        }

        return tx;
    }

    private buildDissociateTransaction(
        options: TokenRejectOperationOptions,
    ): TokenDissociateTransaction {
        // Dissociation needs every distinct token id touched by the reject —
        // the explicit fungible ids plus the parent token id of each NFT
        // serial. Duplicates would trigger TOKEN_REFERENCE_REPEATED, so
        // de-dupe by string id.
        const tokenIds = new Map<string, TokenId | string>();

        for (const tokenId of options.fungibleTokenIds ?? []) {
            tokenIds.set(tokenId.toString(), tokenId);
        }

        for (const nftId of options.nftIds ?? []) {
            tokenIds.set(nftId.tokenId.toString(), nftId.tokenId);
        }

        return new TokenDissociateTransaction()
            .setAccountId(options.ownerId)
            .setTokenIds(Array.from(tokenIds.values()) as TokenId[]);
    }
}
