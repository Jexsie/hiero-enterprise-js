import { Client } from "@hiero-ledger/sdk";
import { HieroContext } from "../../src/context/hiero-context.js";
import { OperatorKeyType } from "../../src/types/index.js";

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
    const ctx = new HieroContext({
        network: "testnet",
        operatorId: SOLO_OPERATOR_ID,
        operatorKey: SOLO_OPERATOR_KEY,
        operatorKeyType: OperatorKeyType.DER,
        mirrorNodeUrl:
            process.env["HIERO_MIRROR_NODE_URL"] || "http://127.0.0.1:5551",
    });

    // Override the client to point to local consensus node
    const localClient = Client.forNetwork({
        "127.0.0.1:50211": "0.0.3",
    });
    localClient.setOperator(ctx.operatorAccountId, SOLO_OPERATOR_KEY);

    // @ts-expect-error test-only override of readonly client
    ctx.client = localClient;

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
