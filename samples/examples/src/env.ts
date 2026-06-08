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
 *
 * Uses the ED25519 operator.
 */
export function getED25519Config(): HieroConfig {
    return {
        network: process.env["HIERO_NETWORK"] ?? "testnet",
        operatorId: process.env["HIERO_ED25519_OPERATOR_ID"]!,
        operatorKey: process.env["HIERO_ED25519_OPERATOR_KEY"]!,
        operatorKeyType: "ed25519",
        mirrorNodeUrl: process.env["HIERO_MIRROR_NODE_URL"],
        networkNodes: parseNetworkNodes(process.env["HIERO_NETWORK_NODES"]),
    };
}

/**
 * Build a HieroConfig using the ECDSA operator account.
 * Use this for examples that specifically demo ECDSA operations.
 */
export function getEcdsaExampleConfig(): HieroConfig {
    return {
        network: process.env["HIERO_NETWORK"] ?? "testnet",
        operatorId: process.env["HIERO_ECDSA_OPERATOR_ID"]!,
        operatorKey: process.env["HIERO_ECDSA_OPERATOR_KEY"]!,
        operatorKeyType: "ecdsa",
        mirrorNodeUrl: process.env["HIERO_MIRROR_NODE_URL"],
        networkNodes: parseNetworkNodes(process.env["HIERO_NETWORK_NODES"]),
    };
}
