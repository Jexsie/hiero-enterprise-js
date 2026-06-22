import type { AccountId, TokenId } from "@hiero-ledger/sdk";
import { TokenDissociateTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type {
    TransactionOptions,
    ScheduleOptions,
    ScheduledResult,
} from "../../transaction/index.js";
import { TokenDissociateValidator } from "../validation/index.js";

/**
 * Low-level options for token dissociation.
 *
 * Mirrors the surface of `TokenDissociateTransaction`: a single account is
 * dissociated from one or more tokens in a single transaction. Keeps SDK
 * prop types as-is while extending `TransactionOptions`.
 */
export interface TokenDissociateOperationOptions extends TransactionOptions {
    accountId: AccountId | string;
    tokenIds: (TokenId | string)[];
}

export class TokenDissociateOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: TokenDissociateValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new TokenDissociateValidator();
    }

    /** Submit a `TokenDissociateTransaction`. */
    async execute(options: TokenDissociateOperationOptions): Promise<void> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.run(
            tx,
            options,
            {
                type: "TokenDissociate",
                serviceName: "TokenService",
                methodName: "dissociateToken",
                timestamp: new Date(),
            },
            () => undefined,
        );
    }

    /** Schedule a `TokenDissociateTransaction` for deferred multi-sig execution. */
    async schedule(
        options: TokenDissociateOperationOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.scheduleRun(
            tx,
            options,
            {
                type: "TokenDissociate",
                serviceName: "TokenService",
                methodName: "dissociateToken",
                timestamp: new Date(),
            },
            scheduleOptions,
        );
    }

    private build(
        options: TokenDissociateOperationOptions,
    ): TokenDissociateTransaction {
        return new TokenDissociateTransaction()
            .setAccountId(options.accountId)
            .setTokenIds(options.tokenIds);
    }
}
