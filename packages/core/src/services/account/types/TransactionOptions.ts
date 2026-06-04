import type { Hbar } from "@hiero-ledger/sdk";

/**
 * Common low-level transaction options inherited from the SDK `Transaction` base class.
 *
 * These options control how a transaction is submitted to the network —
 * fees, validity window, node targeting, etc. They apply to all operations.
 *
 * @see https://docs.hedera.com/hedera/sdks-and-apis/sdks/transactions
 */
export interface TransactionOptions {
    /**
     * Maximum fee the operator is willing to pay for this transaction.
     *
     * If unset, the SDK default (2 HBAR) is used. When using `highVolume: true`
     * (HIP-1313), always set this to cap variable-rate pricing.
     *
     * Accepts a number (HBAR), or an `Hbar` instance for tinybar precision.
     */
    maxTransactionFee?: number | Hbar;

    /**
     * Duration (in seconds) for which this transaction is valid after creation.
     *
     * Defaults to 120 seconds. The network will reject the transaction if it
     * is not received within this window.
     */
    transactionValidDuration?: number;

    /**
     * A note or description recorded in the transaction record (max 100 bytes).
     *
     * This is the *transaction-level* memo (visible in explorers), distinct from
     * any entity-level memo (e.g., account memo).
     */
    transactionMemo?: string;

    /**
     * Specific node account IDs to submit this transaction to.
     *
     * If unset, the SDK automatically selects nodes. Use this for pinning
     * transactions to specific consensus nodes (advanced).
     */
    nodeAccountIds?: string[];

    /**
     * Whether to regenerate the transaction ID on `TRANSACTION_EXPIRED`.
     *
     * Defaults to the client-level setting. Set to `false` to disable
     * automatic retry with a fresh transaction ID.
     */
    regenerateTransactionId?: boolean;
}
