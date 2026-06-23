import type { TokenId } from "@hiero-ledger/sdk";
import { TokenUnpauseTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { TokenUnpauseValidator } from "../validation/index.js";

/**
 * Low-level options for the `TokenUnpauseTransaction` SDK transaction.
 *
 * Mirrors the surface of `TokenUnpauseTransaction` 1:1. Unpausing a
 * previously paused token restores all operations on it — transfers,
 * mints, burns, wipes, freezes / unfreezes, grant / revoke KYC, and
 * other operations resume across the network. The token must have been
 * created with a pause key, and that pause key must sign — supply it
 * via `additionalSigners`.
 *
 * Extends `TransactionOptions` for fees, validity window, and additional
 * signers. Note: `TokenUnpause` is not whitelisted for scheduling on the
 * network, so no `schedule()` variant is exposed.
 */
export interface TokenUnpauseOperationOptions extends TransactionOptions {
    tokenId: TokenId | string;
}

export class TokenUnpauseOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: TokenUnpauseValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new TokenUnpauseValidator();
    }

    /** Submit a `TokenUnpauseTransaction`. */
    async execute(options: TokenUnpauseOperationOptions): Promise<void> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.run(
            tx,
            options,
            {
                type: "TokenUnpause",
                serviceName: "TokenService",
                methodName: "unpauseToken",
                timestamp: new Date(),
            },
            () => undefined,
        );
    }

    private build(
        options: TokenUnpauseOperationOptions,
    ): TokenUnpauseTransaction {
        return new TokenUnpauseTransaction().setTokenId(options.tokenId);
    }
}
