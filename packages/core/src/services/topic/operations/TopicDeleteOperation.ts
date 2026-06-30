import type { TopicId } from "@hiero-ledger/sdk";
import { TopicDeleteTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { TopicDeleteValidator } from "../validation/index.js";

/**
 * Low-level options for the `TopicDeleteTransaction` SDK transaction.
 *
 * Mirrors the surface of `TopicDeleteTransaction` 1:1. Deletion is
 * permanent — no further transactions or queries on the topic will
 * succeed.
 *
 * Signing: the topic's `adminKey` must sign — pass it via
 * `additionalSigners`. A topic without an `adminKey` cannot be deleted
 * and the network rejects the transaction with `UNAUTHORIZED`.
 *
 * Extends `TransactionOptions` for fees, validity window, and additional
 * signers. Note: `TopicDelete` is not whitelisted for scheduling on the
 * network, so no `schedule()` variant is exposed.
 */
export interface TopicDeleteOperationOptions extends TransactionOptions {
    topicId: TopicId | string;
}

export class TopicDeleteOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: TopicDeleteValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new TopicDeleteValidator();
    }

    /** Submit a `TopicDeleteTransaction`. */
    async execute(options: TopicDeleteOperationOptions): Promise<void> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.run(
            tx,
            options,
            {
                type: "TopicDelete",
                serviceName: "TopicService",
                methodName: "deleteTopic",
                timestamp: new Date(),
            },
            () => undefined,
        );
    }

    private build(
        options: TopicDeleteOperationOptions,
    ): TopicDeleteTransaction {
        return new TopicDeleteTransaction().setTopicId(options.topicId);
    }
}
