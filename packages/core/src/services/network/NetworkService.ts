import type {
    NetworkVersionInfo,
    TransactionReceipt,
    TransactionRecord,
} from "@hiero-ledger/sdk";
import {
    NetworkVersionInfoQuery,
    TransactionId,
    TransactionReceiptQuery,
    TransactionRecordQuery,
} from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../context/index.js";
import type { QueryOptions } from "../transaction/index.js";
import { QueryExecutor } from "../transaction/index.js";

/**
 * Options for fetching a transaction receipt.
 *
 * Extends the common {@link QueryOptions} (payer, payment caps, node
 * targeting) with the fields specific to receipt queries.
 */
export interface GetTransactionReceiptOptions extends QueryOptions {
    /**
     * The transaction whose receipt should be fetched. Accepts either a
     * canonical string ID (`"0.0.123@1700000000.000000000"`) or a
     * `TransactionId` instance.
     */
    transactionId: string | TransactionId;
    /**
     * Also fetch the receipts of any child transactions spawned by the
     * original transaction (e.g., contract calls that trigger transfers,
     * scheduled transactions).
     */
    includeChildren?: boolean;
    /**
     * Also fetch receipts of duplicate submissions of the same transaction
     * ID across different nodes.
     */
    includeDuplicates?: boolean;
}

/**
 * Options for fetching a transaction record (identical surface to
 * {@link GetTransactionReceiptOptions}).
 */
export type GetTransactionRecordOptions = GetTransactionReceiptOptions;

/**
 * Public facade for cross-cutting consensus-node queries:
 * receipt / record retrieval and network version info.
 *
 * Use this when you need to query the outcome of a transaction whose
 * `TransactionResponse` you do not have (e.g., submitted out-of-band, by
 * another process, or by a UI), or when you need to inspect the running
 * HAPI / protobuf version of the network.
 *
 * @example
 * ```ts
 * const networkService = new NetworkService(context);
 *
 * // Poll for the receipt of a transaction submitted elsewhere
 * const receipt = await networkService.getTransactionReceipt({
 *     transactionId: "0.0.1234@1700000000.000000000",
 * });
 *
 * // Inspect what the network is running
 * const version = await networkService.getNetworkVersionInfo();
 * console.log(version.servicesVersion.major);
 * ```
 */
export class NetworkService {
    private readonly queryExecutor: QueryExecutor;

    constructor(private readonly context: IHieroContext) {
        this.queryExecutor = new QueryExecutor(context);
    }

    /**
     * Fetch the receipt for a transaction by its ID.
     *
     * Polls until the receipt is available or the SDK's retry budget is
     * exhausted. Failures (including `RECEIPT_NOT_FOUND` and consensus
     * status errors) are normalised to `HieroError`.
     *
     * @param options.transactionId - Transaction whose receipt to fetch (string or `TransactionId`)
     * @param options.includeChildren - Also fetch receipts of child transactions
     * @param options.includeDuplicates - Also fetch duplicate receipts across nodes
     */
    async getTransactionReceipt(
        options: GetTransactionReceiptOptions,
    ): Promise<TransactionReceipt> {
        const txId =
            typeof options.transactionId === "string"
                ? TransactionId.fromString(options.transactionId)
                : options.transactionId;

        const query = new TransactionReceiptQuery().setTransactionId(txId);

        if (options.includeChildren != null) {
            query.setIncludeChildren(options.includeChildren);
        }
        if (options.includeDuplicates != null) {
            query.setIncludeDuplicates(options.includeDuplicates);
        }

        return await this.queryExecutor.run(query, options, {
            type: "TransactionReceiptQuery",
            serviceName: "NetworkService",
            methodName: "getTransactionReceipt",
            timestamp: new Date(),
            transactionId: txId.toString(),
        });
    }

    /**
     * Fetch the full record for a transaction by its ID.
     *
     * Records include the receipt plus fees, transfers, token transfers,
     * contract function results, and child records — everything the
     * network has to say about a transaction.
     *
     * Note: records are not retained indefinitely. For transactions older
     * than the network's record retention window, use the mirror node
     * (`TransactionRepository.findById`).
     *
     * @param options.transactionId - Transaction whose record to fetch (string or `TransactionId`)
     * @param options.includeChildren - Also fetch child transaction records
     * @param options.includeDuplicates - Also fetch duplicate records across nodes
     */
    async getTransactionRecord(
        options: GetTransactionRecordOptions,
    ): Promise<TransactionRecord> {
        const txId =
            typeof options.transactionId === "string"
                ? TransactionId.fromString(options.transactionId)
                : options.transactionId;

        const query = new TransactionRecordQuery().setTransactionId(txId);

        if (options.includeChildren != null) {
            query.setIncludeChildren(options.includeChildren);
        }
        if (options.includeDuplicates != null) {
            query.setIncludeDuplicates(options.includeDuplicates);
        }

        return await this.queryExecutor.run(query, options, {
            type: "TransactionRecordQuery",
            serviceName: "NetworkService",
            methodName: "getTransactionRecord",
            timestamp: new Date(),
            transactionId: txId.toString(),
        });
    }

    /**
     * Fetch the HAPI and protobuf versions the network is running.
     *
     * Useful for diagnostics, health checks, and detecting compatibility
     * issues against custom / local networks.
     *
     * @param options - Optional query options (payer, payment caps, node targeting).
     */
    async getNetworkVersionInfo(
        options: QueryOptions = {},
    ): Promise<NetworkVersionInfo> {
        const query = new NetworkVersionInfoQuery();

        return await this.queryExecutor.run(query, options, {
            type: "NetworkVersionInfoQuery",
            serviceName: "NetworkService",
            methodName: "getNetworkVersionInfo",
            timestamp: new Date(),
        });
    }
}
