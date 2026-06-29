import type { AccountId, Hbar } from "@hiero-ledger/sdk";

/**
 * Common low-level options for SDK consensus-node queries.
 *
 * These apply to any query type — receipt, record, network info, etc. —
 * and control how the query is paid for and routed.
 *
 * @see https://docs.hedera.com/hedera/sdks-and-apis/sdks/queries
 */
export interface QueryOptions {
    /**
     * Account that pays for this query.
     *
     * If unset, the operator account configured on the SDK client pays.
     * Override this when a different account should foot the bill (e.g., a
     * dedicated reads payer with funded HBAR).
     */
    payerAccountId?: string | AccountId;

    /**
     * Maximum amount the payer is willing to pay for this query.
     *
     * If unset, the client-level default applies. The query will fail
     * with `MAX_QUERY_PAYMENT_EXCEEDED` if the network's cost estimate
     * exceeds this cap.
     */
    maxQueryPayment?: number | Hbar;

    /**
     * Exact amount to pay for this query.
     *
     * If set, this overrides the SDK's automatic cost estimation and
     * pays exactly this amount. Most callers should leave this unset
     * and rely on `maxQueryPayment` instead.
     */
    queryPayment?: number | Hbar;

    /**
     * Specific node account IDs to send this query to (e.g., `["0.0.3"]`).
     *
     * If unset, the SDK automatically selects a node. Use this for
     * pinning a query to a specific consensus node (advanced use).
     */
    nodeAccountIds?: string[];
}
