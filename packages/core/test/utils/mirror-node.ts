import { IntegrationTracker } from "./env.js";
import { queryAccountTokens } from "./mirror-node-rest.js";

const LOCAL_MIRROR_URL = process.env.HIERO_MIRROR_NODE_URL;

/**
 * Polls the local Mirror Node REST API until the most recent transaction ID
 * successfully appears in the ledger history.
 * This is CRITICAL for integration tests to avoid strict race-conditions
 * where a transaction is submitted to the consensus node but hasn't yet
 * propagated to the mirror node for the next assertion.
 *
 * @param maxRetries - Max attempts before throwing timeout
 * @param delayMs - Time to wait between polling
 */
export async function waitForMirrorNodeRecord(
    maxRetries = 30,
    delayMs = 2000,
): Promise<void> {
    const transactionId = IntegrationTracker.lastTransactionId;
    if (!transactionId) return; // No transaction to wait for
    // Format hashgraph SDK's `@` formatted strings into the `-` formatted strings the REST API expects
    const parts = transactionId.split("@");
    const formattedId = `${parts[0]}-${parts[1].replace(".", "-")}`;

    const endpoint = `${LOCAL_MIRROR_URL}/api/v1/transactions/${formattedId}`;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(endpoint);
            if (response.ok) {
                const data = (await response.json()) as {
                    transactions?: unknown[];
                };
                if (data.transactions && data.transactions.length > 0) {
                    // Record exists and propagated!
                    IntegrationTracker.lastTransactionId = undefined; // reset
                    return;
                }
            }
        } catch {
            // Mirror node might be momentarily unreachable, just ignore and keep polling
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Error(
        `[Integration Test Timeout] Transaction ${transactionId} never appeared on the Solo Mirror Node after ${
            (maxRetries * delayMs) / 1000
        } seconds.`,
    );
}

/**
 * Polls the Mirror Node until every listed token relationship has been
 * removed from `accountId`. Use this after multi-transaction SDK flows
 * (e.g. `TokenRejectFlow`) where only the *first* inner transaction's ID
 * is exposed to `waitForMirrorNodeRecord` — the second (dissociate) may
 * still be propagating when the first one becomes queryable, leaving the
 * relationship row visible with `balance: 0`.
 */
export async function waitForAccountTokensAbsent(
    accountId: string,
    tokenIds: string[],
    maxRetries = 30,
    delayMs = 2000,
): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
        const relationships = await queryAccountTokens(accountId);
        const stillPresent = tokenIds.filter((id) =>
            relationships.some((t) => t.token_id === id),
        );
        if (stillPresent.length === 0) return;

        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    throw new Error(
        `[Integration Test Timeout] Account ${accountId} still has token relationships [${tokenIds.join(
            ", ",
        )}] after ${(maxRetries * delayMs) / 1000} seconds.`,
    );
}
