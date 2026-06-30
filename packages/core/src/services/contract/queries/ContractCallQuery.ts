import type {
    ContractId,
    AccountId,
    Long,
    Hbar,
    ContractFunctionParameters,
    ContractFunctionResult,
} from "@hiero-ledger/sdk";
import { ContractCallQuery as SdkContractCallQuery } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { normalizeError } from "../../../errors/index.js";

/**
 * Options for invoking a view / pure contract function locally via
 * `ContractCallQuery`.
 *
 * The call executes on the queried node only — there is no consensus
 * round-trip and no gas is charged on success, so this is the cheap path
 * for reading on-chain state. Use `ContractService.executeContract`
 * when the call must mutate state.
 *
 * Exactly one call-target form must be supplied:
 * - `functionName` (with optional ABI-typed `functionParameters`) — the
 *   common path; the SDK encodes the call data for you.
 * - `rawFunctionParameters` — pre-encoded ABI bytes for advanced
 *   callers that build call data themselves.
 */
export interface ContractCallQueryOptions {
    /** Contract to invoke. */
    contractId: string | ContractId;
    /** Gas limit for the local call. Required. */
    gas: number | Long;
    /**
     * Name of the contract function to invoke. Combined with
     * `functionParameters` via `setFunction(name, params)`. Mutually
     * exclusive with `rawFunctionParameters`.
     */
    functionName?: string;
    /**
     * ABI-typed parameters for the function call. Ignored unless
     * `functionName` is also set.
     */
    functionParameters?: ContractFunctionParameters;
    /**
     * Pre-encoded ABI call data (function selector + arguments).
     * Mutually exclusive with `functionName`.
     */
    rawFunctionParameters?: Uint8Array;
    /** Account that should be treated as `msg.sender` inside the call. */
    senderAccountId?: string | AccountId;
    /** Maximum size of the returned result bytes. */
    maxResultSize?: number | Long;
    /** Fixed query payment instead of letting the SDK estimate. */
    queryPayment?: Hbar;
    /** Cap on the SDK's auto-estimated query payment. */
    maxQueryPayment?: Hbar;
}

/**
 * Local read-only contract call. Returns the SDK's
 * `ContractFunctionResult` so callers can use the typed decoders
 * (`getUint256(0)`, `getString(0)`, `getAddress(0)`, …) directly.
 */
export class ContractCallQuery {
    constructor(private readonly context: IHieroContext) {}

    async execute(
        options: ContractCallQueryOptions,
    ): Promise<ContractFunctionResult> {
        this.validate(options);

        try {
            const query = new SdkContractCallQuery()
                .setContractId(options.contractId)
                .setGas(options.gas);

            if (options.functionName != null && options.functionName !== "") {
                query.setFunction(
                    options.functionName,
                    options.functionParameters,
                );
            } else {
                // validator guarantees rawFunctionParameters is set when functionName is not
                query.setFunctionParameters(options.rawFunctionParameters!);
            }

            if (options.senderAccountId != null) {
                query.setSenderAccountId(options.senderAccountId);
            }

            if (options.maxResultSize != null) {
                query.setMaxResultSize(options.maxResultSize);
            }

            if (options.queryPayment != null) {
                query.setQueryPayment(options.queryPayment);
            }

            if (options.maxQueryPayment != null) {
                query.setMaxQueryPayment(options.maxQueryPayment);
            }

            return await query.execute(this.context.client);
        } catch (error) {
            throw normalizeError(error, "ContractService.callContract");
        }
    }

    /**
     * Minimal input validation. The SDK will throw on most malformed
     * inputs (missing contractId, invalid IDs, etc.) — we only catch
     * the cases the SDK silently mis-handles, plus the call-target mutex
     * that is ambiguous if both forms are supplied.
     */
    private validate(options: ContractCallQueryOptions): void {
        const hasFunctionName =
            options.functionName != null && options.functionName !== "";
        const hasRawParameters = options.rawFunctionParameters != null;

        if (!hasFunctionName && !hasRawParameters) {
            throw normalizeError(
                new Error(
                    "ContractCallQuery requires either functionName or rawFunctionParameters.",
                ),
                "ContractService.callContract",
            );
        }

        if (hasFunctionName && hasRawParameters) {
            throw normalizeError(
                new Error(
                    "ContractCallQuery accepts functionName or rawFunctionParameters, not both.",
                ),
                "ContractService.callContract",
            );
        }
    }
}
