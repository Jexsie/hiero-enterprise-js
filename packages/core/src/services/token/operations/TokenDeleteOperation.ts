import type { TokenId } from "@hiero-ledger/sdk";
import { TokenDeleteTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
    ScheduledResult,
} from "../../transaction/index.js";
import { TokenDeleteValidator } from "../validation/index.js";

/**
 * Low-level options for the `TokenDeleteTransaction` SDK transaction.
 *
 * Mirrors the surface of `TokenDeleteTransaction` 1:1. Deletion marks the
 * token as deleted on the network; the token's admin key must sign the
 * transaction (supply it via `additionalSigners`).
 *
 * Extends `TransactionOptions` for fees, validity window, additional signers,
 * and scheduling.
 */
export interface TokenDeleteOperationOptions extends TransactionOptions {
    tokenId: TokenId | string;
}

export class TokenDeleteOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: TokenDeleteValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new TokenDeleteValidator();
    }

    /** Submit a `TokenDeleteTransaction`. */
    async execute(options: TokenDeleteOperationOptions): Promise<void> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.run(
            tx,
            options,
            {
                type: "TokenDelete",
                serviceName: "TokenService",
                methodName: "deleteToken",
                timestamp: new Date(),
            },
            () => undefined,
        );
    }

    /** Schedule a `TokenDeleteTransaction` for deferred multi-sig execution. */
    async schedule(
        options: TokenDeleteOperationOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.scheduleRun(
            tx,
            options,
            {
                type: "TokenDelete",
                serviceName: "TokenService",
                methodName: "deleteToken",
                timestamp: new Date(),
            },
            scheduleOptions,
        );
    }

    private build(
        options: TokenDeleteOperationOptions,
    ): TokenDeleteTransaction {
        return new TokenDeleteTransaction().setTokenId(options.tokenId);
    }
}
