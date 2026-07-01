import { HieroContext } from "../../src/context/index.js";

/**
 * Mirror-node gRPC endpoint used by consensus-stream queries
 * (`TopicMessageQuery.subscribe`, mirror `ContractCallQuery`, …) in the
 * integration environment.
 */
export const MIRROR_GRPC_ADDRESS = "localhost:5600";

export const IntegrationTracker = {
    lastTransactionId: "" as string | undefined,
};

export function setupIntegrationTestEnv(): HieroContext {
    const ctx = new HieroContext();

    // Attach tracker to automatically hook the generated ID
    ctx.addTransactionListener({
        onAfterTransaction: (event) => {
            if (event.transactionId) {
                IntegrationTracker.lastTransactionId = event.transactionId;
            }
        },
    });

    return ctx;
}
