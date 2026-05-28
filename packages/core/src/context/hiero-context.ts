import type { Transaction } from "@hiero-ledger/sdk";
import { Client, AccountId, PrivateKey } from "@hiero-ledger/sdk";
import type { HieroConfig } from "../config/index.js";
import { resolveConfigFromEnv, assertEnvConfigValid } from "../config/index.js";
import { HieroError, HieroErrorCode } from "../errors/index.js";
import type {
    TransactionListener,
    TransactionEvent,
} from "../listeners/index.js";
import type { IHieroContext } from "./hiero-context.interface.js";

/**
 * Central context for interacting with a Hiero network.
 * Manages the SDK Client lifecycle and provides access to the operator account.
 *
 * This is NOT a singleton — create one instance per application lifecycle.
 * Framework integrations (Express middleware, Fastify plugin, NestJS module)
 * manage the instance scope.
 *
 * @example
 * ```ts
 * const ctx = new HieroContext({ network: 'testnet', operatorId: '0.0.1', operatorKey: '302e...' });
 * const client = ctx.client;
 * ```
 */
export class HieroContext implements IHieroContext {
    /** Registered transaction listeners */
    private readonly listeners: TransactionListener[] = [];

    /** The operator private key — kept private to prevent accidental leakage */
    private readonly _operatorKey: PrivateKey;

    /** The underlying Hiero SDK Client */
    public readonly client: Client;

    /** The resolved configuration */
    public readonly config: HieroConfig;

    /** The operator account ID */
    public readonly operatorAccountId: AccountId;

    constructor(config?: HieroConfig) {
        if (!config) {
            assertEnvConfigValid();
        }
        const resolved = config ?? resolveConfigFromEnv()!;
        this.config = resolved;

        // Resolve network
        const network = resolved.network.toLowerCase();
        if (network === "mainnet" || network === "hedera-mainnet") {
            this.client = Client.forMainnet();
        } else if (network === "testnet" || network === "hedera-testnet") {
            this.client = Client.forTestnet();
        } else if (
            network === "previewnet" ||
            network === "hedera-previewnet"
        ) {
            this.client = Client.forPreviewnet();
        } else if (resolved.mirrorNodeUrl) {
            // Custom network — requires explicit mirror node URL
            this.client = Client.forNetwork({});
            this.client.setMirrorNetwork([resolved.mirrorNodeUrl]);
        } else {
            throw new HieroError(
                `Unknown network "${resolved.network}". Provide a mirrorNodeUrl for custom networks.`,
                { code: HieroErrorCode.ConfigInvalid },
            );
        }

        // Parse and validate operator credentials
        this.operatorAccountId = AccountId.fromString(resolved.operatorId);

        try {
            this._operatorKey = PrivateKey.fromStringDer(resolved.operatorKey);
        } catch (cause) {
            throw new HieroError(
                `Invalid operator key format. Ensure HIERO_OPERATOR_KEY is a valid DER-encoded private key.`,
                {
                    code: HieroErrorCode.ConfigInvalid,
                    cause: cause instanceof Error ? cause : undefined,
                },
            );
        }

        this.client.setOperator(this.operatorAccountId, this._operatorKey);

        // Apply SDK client tuning options
        if (resolved.requestTimeoutMs !== undefined) {
            this.client.setRequestTimeout(resolved.requestTimeoutMs);
        }
        if (resolved.maxAttempts !== undefined) {
            this.client.setMaxAttempts(resolved.maxAttempts);
        }
        if (resolved.minBackoffMs !== undefined) {
            this.client.setMinBackoff(resolved.minBackoffMs);
        }
        if (resolved.maxBackoffMs !== undefined) {
            this.client.setMaxBackoff(resolved.maxBackoffMs);
        }
    }

    /**
     * Get the operator's public key (safe to expose).
     */
    public get operatorPublicKey() {
        return this._operatorKey.publicKey;
    }

    /**
     * Sign a transaction with the operator key.
     * Use this instead of accessing the private key directly.
     */
    public async signTransaction<T extends Transaction>(tx: T): Promise<T> {
        return tx.sign(this._operatorKey);
    }

    /**
     * Close the SDK client and release resources.
     */
    public close(): void {
        this.client.close();
    }

    // ─── Transaction Listener Management ─────────────────────────

    /**
     * Register a transaction listener.
     *
     * @param listener - Listener to register
     */
    public addTransactionListener(listener: TransactionListener): void {
        this.listeners.push(listener);
    }

    /**
     * Remove a previously registered transaction listener.
     *
     * @param listener - Listener to remove
     */
    public removeTransactionListener(listener: TransactionListener): void {
        const idx = this.listeners.indexOf(listener);
        if (idx !== -1) {
            this.listeners.splice(idx, 1);
        }
    }

    /**
     * Emit a before-transaction event to all registered listeners.
     * Called internally by service clients before executing a transaction.
     *
     * @param event - The transaction event
     */
    public async emitBeforeTransaction(event: TransactionEvent): Promise<void> {
        for (const listener of this.listeners) {
            if (listener.onBeforeTransaction) {
                await listener.onBeforeTransaction(event);
            }
        }
    }

    /**
     * Emit an after-transaction event to all registered listeners.
     * Called internally by service clients after a transaction completes.
     *
     * @param event - The transaction event (includes result/error/duration)
     */
    public async emitAfterTransaction(event: TransactionEvent): Promise<void> {
        for (const listener of this.listeners) {
            if (listener.onAfterTransaction) {
                await listener.onAfterTransaction(event);
            }
        }
    }
}
