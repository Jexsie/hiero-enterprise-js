import type { HieroConfig } from "@hiero-enterprise/core";

/**
 * Parse HIERO_NETWORK_NODES env var.
 * Format: "host:port=accountId,host:port=accountId"
 * Example: "127.0.0.1:50211=0.0.3"
 */
function parseNetworkNodes(raw?: string): Record<string, string> | undefined {
    if (!raw) return undefined;
    const nodes: Record<string, string> = {};
    for (const entry of raw.split(",")) {
        const [address, accountId] = entry.trim().split("=");
        if (address && accountId) {
            // eslint-disable-next-line security/detect-object-injection
            nodes[address] = accountId;
        }
    }
    return Object.keys(nodes).length > 0 ? nodes : undefined;
}

/**
 * Build a HieroConfig from environment variables with sensible defaults
 * for local development. Used by all example scripts.
 */
export function getExampleConfig(): HieroConfig {
    return {
        network: process.env["HIERO_NETWORK"] ?? "testnet",
        operatorId: process.env["HIERO_OPERATOR_ID"]!,
        operatorKey: process.env["HIERO_OPERATOR_KEY"]!,
        operatorKeyType: process.env["HIERO_OPERATOR_KEY_TYPE"] ?? "ed25519",
        mirrorNodeUrl: process.env["HIERO_MIRROR_NODE_URL"],
        networkNodes: parseNetworkNodes(process.env["HIERO_NETWORK_NODES"]),
    };
}
