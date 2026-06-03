import { HieroError, HieroErrorCodes } from "../errors/index.js";
import type { OperatorKeyType } from "../types/index.js";

/**
 * Configuration for connecting to a Hiero network.
 */
export interface HieroConfig {
    /** Network to connect to (e.g., "testnet", "mainnet", "previewnet", or custom) */
    readonly network: string;
    /** Operator account ID (e.g., "0.0.12345") */
    readonly operatorId: string;
    /** Operator private key */
    readonly operatorKey: string;
    /** Type of the operator private key — required to correctly parse the key material */
    readonly operatorKeyType: OperatorKeyType;
    /** Mirror node base URL (auto-resolved if not provided) */
    readonly mirrorNodeUrl?: string;
    /** Request timeout in milliseconds (default: 120000) */
    readonly requestTimeoutMs?: number;
    /** gRPC deadline in milliseconds (default: 10000) */
    readonly grpcDeadlineMs?: number;
    /** Max transaction submission attempts (default: 10) */
    readonly maxAttempts?: number;
    /** Minimum backoff in milliseconds (default: 250) */
    readonly minBackoffMs?: number;
    /** Maximum backoff in milliseconds (default: 8000) */
    readonly maxBackoffMs?: number;
    /** Mirror node request timeout in milliseconds (default: 10000) */
    readonly mirrorNodeTimeoutMs?: number;
    /** Mirror node request max retries (default: 3) */
    readonly mirrorNodeMaxRetries?: number;
}

/**
 * Known network names and their mirror node URLs.
 */
const MIRROR_NODE_URLS: Record<string, string> = {
    mainnet: "https://mainnet.mirrornode.hedera.com",
    testnet: "https://testnet.mirrornode.hedera.com",
    previewnet: "https://previewnet.mirrornode.hedera.com",
    "hedera-mainnet": "https://mainnet.mirrornode.hedera.com",
    "hedera-testnet": "https://testnet.mirrornode.hedera.com",
    "hedera-previewnet": "https://previewnet.mirrornode.hedera.com",
};

/**
 * Resolve the mirror node URL for a given network.
 *
 * @param network - Network name or custom URL
 * @param explicitUrl - Explicitly provided mirror node URL (takes priority)
 * @returns The mirror node base URL
 */
export function resolveMirrorNodeUrl(
    network: string,
    explicitUrl?: string,
): string {
    if (explicitUrl) {
        return explicitUrl;
    }
    const url = MIRROR_NODE_URLS[network.toLowerCase()];
    if (!url) {
        throw new HieroError(
            `Unknown network "${network}". Provide a mirrorNodeUrl in the config.`,
            { code: HieroErrorCodes.ConfigInvalid },
        );
    }
    return url;
}

/**
 * Resolve a HieroConfig from environment variables.
 *
 * Reads from:
 *   HIERO_NETWORK
 *   HIERO_OPERATOR_ID
 *   HIERO_OPERATOR_KEY
 *   HIERO_MIRROR_NODE_URL
 *
 * @returns A HieroConfig or null if required env vars are missing
 */
export function resolveConfigFromEnv(): HieroConfig | null {
    const network = process.env["HIERO_NETWORK"];
    const operatorId = process.env["HIERO_OPERATOR_ID"];
    const operatorKey = process.env["HIERO_OPERATOR_KEY"];
    const operatorKeyType = process.env[
        "HIERO_OPERATOR_KEY_TYPE"
    ]?.toLowerCase() as OperatorKeyType | undefined;
    const mirrorNodeUrl = process.env["HIERO_MIRROR_NODE_URL"];

    if (!network || !operatorId || !operatorKey || !operatorKeyType) {
        return null;
    }

    return {
        network,
        operatorId,
        operatorKey,
        operatorKeyType,
        mirrorNodeUrl,
    };
}

/**
 * Validates the environment and throws a HieroError explaining exactly what is missing.
 */
export function assertEnvConfigValid(): void {
    const network = process.env["HIERO_NETWORK"];
    const operatorId = process.env["HIERO_OPERATOR_ID"];
    const operatorKey = process.env["HIERO_OPERATOR_KEY"];
    const operatorKeyType = process.env["HIERO_OPERATOR_KEY_TYPE"];

    const missing = [];
    if (!network)
        missing.push(
            "HIERO_NETWORK (e.g., 'testnet', 'mainnet', 'previewnet')",
        );
    if (!operatorId) missing.push("HIERO_OPERATOR_ID (e.g., '0.0.12345')");
    if (!operatorKey) missing.push("HIERO_OPERATOR_KEY (your private key)");
    if (!operatorKeyType)
        missing.push(
            "HIERO_OPERATOR_KEY_TYPE (one of: 'ed25519', 'ecdsa', 'der')",
        );

    if (missing.length > 0) {
        throw new HieroError(
            `Missing required Hiero environment variables:\n  - ${missing.join("\n  - ")}\n\n` +
                `Set them in your process environment before application startup.`,
            { code: HieroErrorCodes.ConfigInvalid },
        );
    }
}
