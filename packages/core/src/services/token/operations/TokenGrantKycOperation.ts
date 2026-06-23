import type { AccountId, TokenId } from "@hiero-ledger/sdk";
import { TokenGrantKycTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { TokenGrantKycValidator } from "../validation/index.js";

/**
 * Low-level options for the `TokenGrantKycTransaction` SDK transaction.
 *
 * Mirrors the surface of `TokenGrantKycTransaction` 1:1. Granting KYC
 * marks `accountId` as KYC-approved for the given token, allowing it to
 * transfer the token. The token's KYC key must sign (supply it via
 * `additionalSigners`). The target account must already be associated
 * with the token.
 *
 * Extends `TransactionOptions` for fees, validity window, and additional
 * signers. Note: `TokenGrantKyc` is not whitelisted for scheduling on the
 * network, so no `schedule()` variant is exposed.
 */
export interface TokenGrantKycOperationOptions extends TransactionOptions {
    tokenId: TokenId | string;
    accountId: AccountId | string;
}

export class TokenGrantKycOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: TokenGrantKycValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new TokenGrantKycValidator();
    }

    /** Submit a `TokenGrantKycTransaction`. */
    async execute(options: TokenGrantKycOperationOptions): Promise<void> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.run(
            tx,
            options,
            {
                type: "TokenGrantKyc",
                serviceName: "TokenService",
                methodName: "grantKycToken",
                timestamp: new Date(),
            },
            () => undefined,
        );
    }

    private build(
        options: TokenGrantKycOperationOptions,
    ): TokenGrantKycTransaction {
        return new TokenGrantKycTransaction()
            .setTokenId(options.tokenId)
            .setAccountId(options.accountId);
    }
}
