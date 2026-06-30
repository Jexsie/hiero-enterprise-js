import type { CustomFeeLimit, Long, TopicId } from "@hiero-ledger/sdk";
import { TopicMessageSubmitTransaction } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { TransactionExecutor } from "../../transaction/index.js";
import type { TransactionOptions } from "../../transaction/index.js";
import { TopicMessageSubmitValidator } from "../validation/index.js";

/**
 * Low-level options for the `TopicMessageSubmitTransaction` SDK
 * transaction.
 *
 * Mirrors the surface of `TopicMessageSubmitTransaction`. Callers
 * usually go through `TopicService.submitMessage`, which exposes the
 * same shape.
 *
 * Signing rules (enforced by the network):
 *  - If the topic has a `submitKey`, that key MUST sign the
 *    transaction — pass it via `additionalSigners`.
 *  - If the topic has HIP-991 `customFees` and the submitter isn't on
 *    the `feeExemptKeys` list, the submitter pays the fee. Use
 *    `customFeeLimits` to cap the maximum fee you're willing to pay.
 *
 * Chunking: messages larger than `chunkSize` (default 1024 bytes) are
 * automatically split into multiple chunks and submitted in sequence;
 * the SDK handles this transparently. The returned receipt corresponds
 * to the **first** chunk.
 *
 * Extends `TransactionOptions` for fees, validity window, and additional
 * signers. Note: `TopicMessageSubmit` is not exposed for scheduling in
 * this initial implementation, though the network permits it.
 */
export interface TopicMessageSubmitOperationOptions extends TransactionOptions {
    /** Topic to submit the message to. */
    topicId: TopicId | string;
    /** Message payload — UTF-8 string or raw bytes. Must be non-empty. */
    message: string | Uint8Array;
    /**
     * Maximum number of chunks the SDK is allowed to split the message
     * into. Defaults to 20 on the SDK side. Increase for very large
     * payloads, set to `1` to forbid chunking.
     */
    maxChunks?: number;
    /**
     * Chunk size in bytes. Defaults to 1024 on the SDK side. Lower
     * values produce more, smaller chunks; higher values reduce chunk
     * count.
     */
    chunkSize?: number;
    /**
     * HIP-991 fee caps — the maximum custom fee the submitter is
     * willing to pay for this submission. Without limits, the submitter
     * implicitly accepts whatever fee the topic's current `customFees`
     * dictate.
     */
    customFeeLimits?: CustomFeeLimit[];
}

/**
 * Result returned after a successful `TopicMessageSubmit`.
 *
 * For multi-chunk submissions the values correspond to the **first**
 * chunk's receipt; subsequent chunks increment the sequence number.
 */
export interface TopicMessageSubmitResult {
    /** Topic-scoped sequence number assigned by the consensus node. */
    sequenceNumber: Long;
    /** Updated running hash of all messages on the topic. */
    runningHash: Uint8Array;
    /** Network transaction ID for the submission. */
    transactionId: string;
}

export class TopicMessageSubmitOperation {
    private readonly executor: TransactionExecutor;
    private readonly validator: TopicMessageSubmitValidator;

    constructor(context: IHieroContext) {
        this.executor = new TransactionExecutor(context);
        this.validator = new TopicMessageSubmitValidator();
    }

    /**
     * Submit a message to a topic. Returns the sequence number,
     * running hash, and transaction ID from the receipt.
     */
    async execute(
        options: TopicMessageSubmitOperationOptions,
    ): Promise<TopicMessageSubmitResult> {
        this.validator.validate(options);

        const tx = this.build(options);

        return await this.executor.run(
            tx,
            options,
            {
                type: "TopicMessageSubmit",
                serviceName: "TopicService",
                methodName: "submitMessage",
                timestamp: new Date(),
            },
            (receipt, transactionId) => ({
                sequenceNumber: receipt.topicSequenceNumber!,
                runningHash: receipt.topicRunningHash!,
                transactionId,
            }),
        );
    }

    private build(
        options: TopicMessageSubmitOperationOptions,
    ): TopicMessageSubmitTransaction {
        const tx = new TopicMessageSubmitTransaction()
            .setTopicId(options.topicId)
            .setMessage(options.message);

        if (options.maxChunks != null) {
            tx.setMaxChunks(options.maxChunks);
        }

        if (options.chunkSize != null) {
            tx.setChunkSize(options.chunkSize);
        }

        if (options.customFeeLimits != null) {
            tx.setCustomFeeLimits(options.customFeeLimits);
        }

        return tx;
    }
}
