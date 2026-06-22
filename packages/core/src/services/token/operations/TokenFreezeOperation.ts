import type { AccountId, TokenId } from "@hiero-ledger/sdk";
import { TokenFreezeTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { TokenFreezeValidator } from "../validation/index.js";

/**
 * Low-level options for the `TokenFreezeTransaction` SDK transaction.
 *
 * Mirrors the surface of `TokenFreezeTransaction` 1:1. Freezing prevents
 * `accountId` from sending or receiving the token until it is unfrozen.
 * The token's freeze key must sign (supply it via `additionalSigners`).
 *
 * Extends `TransactionOptions` for fees, validity window, and additional
 * signers. Note: `TokenFreeze` is not whitelisted for scheduling on the
 * network, so no `schedule()` variant is exposed.
 */
export interface TokenFreezeOperationOptions extends TransactionOptions {
    tokenId: TokenId | string;
    accountId: AccountId | string;
}

export class TokenFreezeOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: TokenFreezeValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new TokenFreezeValidator();
    }

    /** Submit a `TokenFreezeTransaction`. */
    async execute(options: TokenFreezeOperationOptions): Promise<void> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.run(
            tx,
            options,
            {
                type: "TokenFreeze",
                serviceName: "TokenService",
                methodName: "freezeToken",
                timestamp: new Date(),
            },
            () => undefined,
        );
    }

    private build(
        options: TokenFreezeOperationOptions,
    ): TokenFreezeTransaction {
        return new TokenFreezeTransaction()
            .setTokenId(options.tokenId)
            .setAccountId(options.accountId);
    }
}
