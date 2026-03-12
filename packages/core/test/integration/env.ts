import { Client } from "@hashgraph/sdk";
import { HieroContext } from "../../src/context/hiero-context.js";

// Operator ID and Private Key from a standard Hiero Solo Network setup
// (As defined by @hashgraph/solo defaults)
export const SOLO_OPERATOR_ID = "0.0.2";
export const SOLO_OPERATOR_KEY =
    "302e020100300506032b65700422042091132178e72057a1d7528025956fe39b0b847f200ab59b2fdd367017f3087137";

export const IntegrationTracker = {
    lastTransactionId: "" as string | undefined,
};

/**
 * Initializes and wires the HieroContext specifically to a locally running Solo Network.
 */
export function setupIntegrationTestEnv(): HieroContext {
    HieroContext.reset();

    // Create a client explicitly pointing to the local proxy/consensus nodes
    const localClient = Client.forNetwork({
        "127.0.0.1:50211": "0.0.3",
    });

    const ctx = HieroContext.initialize({
        network: "testnet", // Pass testnet to bypass strict constructor validation, overridden via `.client`
        operatorId: SOLO_OPERATOR_ID,
        operatorKey: SOLO_OPERATOR_KEY,
    });

    // We must forcibly override the initialized Client to hit our specific localhost socket since "testnet" configs look for remote consensus nodes.
    // The HieroContext makes `client` readonly strictly from the TS perspective, but we break that here in the integration environment explicitly.
    // @ts-expect-error test-only override
    ctx.client = localClient;
    ctx.client.setOperator(ctx.operatorAccountId, ctx.operatorKey);

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
