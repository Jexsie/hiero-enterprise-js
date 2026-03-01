/**
 * Configuration for connecting to a Hiero network.
 */
export interface HieroConfig {
    /** Network to connect to (e.g., "testnet", "mainnet", "previewnet", or custom) */
    readonly network: string;
    /** Operator account ID (e.g., "0.0.12345") */
    readonly operatorId: string;
    /** Operator private key (DER encoded) */
    readonly operatorKey: string;
    /** Mirror node base URL (auto-resolved if not provided) */
    readonly mirrorNodeUrl?: string;
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
        throw new Error(
            `Unknown network "${network}". Provide a mirrorNodeUrl in the config.`,
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
    const mirrorNodeUrl = process.env["HIERO_MIRROR_NODE_URL"];

    if (!network || !operatorId || !operatorKey) {
        return null;
    }

    return {
        network,
        operatorId,
        operatorKey,
        mirrorNodeUrl,
    };
}

/**
 * Validates the environment and throws a detailed error explaining exactly what is missing.
 */
export function assertEnvConfigValid(): void {
    const network = process.env["HIERO_NETWORK"];
    const operatorId = process.env["HIERO_OPERATOR_ID"];
    const operatorKey = process.env["HIERO_OPERATOR_KEY"];

    const missing = [];
    if (!network)
        missing.push(
            "HIERO_NETWORK (e.g., 'testnet', 'mainnet', 'previewnet')",
        );
    if (!operatorId) missing.push("HIERO_OPERATOR_ID (e.g., '0.0.12345')");
    if (!operatorKey) missing.push("HIERO_OPERATOR_KEY (e.g., '302e02...')");

    if (missing.length > 0) {
        throw new Error(
            `\n` +
                `=================================================================\n` +
                `❌ Missing Required Hiero Configuration\n` +
                `=================================================================\n\n` +
                `To initialize the Hiero context, you must either pass a config object\n` +
                `explicitly or set the following environment variables:\n\n` +
                missing.map((m) => `  - ${m}`).join("\n") +
                `\n\n` +
                `Example .env file:\n` +
                `-----------------------------------------------------------------\n` +
                `HIERO_NETWORK=testnet\n` +
                `HIERO_OPERATOR_ID=0.0.xxxxx\n` +
                `HIERO_OPERATOR_KEY=302e020100300506032b657004220420...\n` +
                `=================================================================\n`,
        );
    }
}
