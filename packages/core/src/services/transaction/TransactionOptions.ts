import type { Hbar, PublicKey, PrivateKey } from "@hiero-ledger/sdk";

/**
 * An external signer delegates signing to a function — used for HSM, KMS,
 * or wallet integrations where the private key never leaves the secure boundary.
 */
export interface ExternalSigner {
    /** The public key corresponding to the external signer. */
    publicKey: PublicKey;
    /** Signing function — receives the raw message bytes and returns the signature. */
    sign: (message: Uint8Array) => Promise<Uint8Array>;
}

/**
 * A pre-computed signature to attach via `_addSignatureLegacy`.
 * Used when the signature is produced offline or by an external process.
 */
export interface LegacySignature {
    publicKey: PublicKey;
    /** Single signature or one per node (chunked transactions). */
    signature: Uint8Array | Uint8Array[];
}

/**
 * Common low-level transaction options inherited from the SDK `Transaction` base class.
 *
 * These options control how a transaction is submitted to the network —
 * fees, validity window, node targeting, signing, etc. They apply to all operations.
 *
 * @see https://docs.hedera.com/hedera/sdks-and-apis/sdks/transactions
 */
export interface TransactionOptions {
    /**
     * Maximum fee the operator is willing to pay for this transaction.
     *
     * If unset, the SDK default (2 HBAR) is used. When using `highVolume: true`
     * (HIP-1313), always set this to cap variable-rate pricing.
     *
     * Accepts a number (HBAR) or an `Hbar` instance for tinybar precision.
     */
    maxTransactionFee?: number | Hbar;

    /**
     * Duration (in seconds) for which this transaction is valid after creation.
     *
     * Defaults to 120 seconds. The network rejects the transaction if it
     * is not received within this window.
     */
    transactionValidDuration?: number;

    /**
     * A note or description recorded in the transaction record (max 100 bytes).
     *
     * This is the *transaction-level* memo (visible in explorers), distinct from
     * any entity-level memo (e.g., account memo set via `memo`).
     */
    transactionMemo?: string;

    /**
     * Specific node account IDs to submit this transaction to (e.g., `["0.0.3"]`).
     *
     * If unset, the SDK automatically selects nodes. Use this for pinning
     * transactions to specific consensus nodes (advanced use).
     */
    nodeAccountIds?: string[];

    /**
     * Whether to regenerate the transaction ID on `TRANSACTION_EXPIRED`.
     *
     * Defaults to the client-level setting. Set to `false` to disable
     * automatic retry with a fresh transaction ID.
     */
    regenerateTransactionId?: boolean;

    /**
     * Enable high-volume throttle capacity for this transaction (HIP-1313).
     *
     * Routes through dedicated high-volume throttle capacity with variable-rate
     * pricing. Pair with `maxTransactionFee` to cap costs. Only affects
     * supported transaction types; ignored otherwise.
     */
    highVolume?: boolean;

    /**
     * Additional private keys that must co-sign this transaction (e.g., a
     * multi-sig account's threshold keys).
     *
     * Applied before execution — the transaction is frozen, these keys sign,
     * then the operator auto-signs during execution.
     * Causes an implicit `freezeWith(client)` before signing.
     */
    additionalSigners?: PrivateKey[];

    /**
     * External signers for HSM, KMS, or wallet integrations.
     *
     * Each entry provides a public key and an async signing function.
     * Applied alongside `additionalSigners`. Also causes an implicit freeze.
     */
    externalSigners?: ExternalSigner[];

    /**
     * Pre-computed signatures to attach via `_addSignatureLegacy`.
     *
     * Used when the signature is produced offline (e.g., an air-gapped signer)
     * and needs to be attached before the transaction is submitted.
     */
    legacySignatures?: LegacySignature[];
}

/**
 * Options for SDK convenience flow objects (e.g., `ContractCreateFlow`).
 *
 * Flows orchestrate multiple inner transactions internally, so they don't
 * surface per-transaction settings like `maxTransactionFee`,
 * `transactionMemo`, or `transactionValidDuration`. Only signing
 * primitives carry over.
 */
export interface FlowOptions {
    /**
     * Additional private keys that must co-sign every inner transaction
     * produced by the flow (e.g., the contract's admin key).
     */
    additionalSigners?: PrivateKey[];

    /**
     * External signers (HSM / KMS / wallet) applied to every inner
     * transaction produced by the flow.
     */
    externalSigners?: ExternalSigner[];
}
