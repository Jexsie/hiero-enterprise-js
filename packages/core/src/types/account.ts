import type { PrivateKey } from "@hiero-ledger/sdk";

/**
 * The type of account (and underlying key) to generate.
 */
export enum AccountType {
    NATIVE = "ED25519",
    EVM = "ECDSA",
}

/**
 * Represents a Hiero network account.
 */
export interface Account {
    /** The account ID (e.g., "0.0.12345") */
    accountId: string;
    /** The public key associated with the account */
    publicKey: string;
    /** The EVM address derived from the public key */
    evmAddress?: string;
}

/**
 * Returned by account creation methods that generate a new key locally.
 * Contains the private key that must be stored securely by the caller.
 * The network never returns private key material; it is generated client-side
 * before submission and is not available again after creation.
 */
export interface CreatedAccount extends Account {
    /**
     * The newly generated private key.
     * Store it securely immediately; the key is not retrievable from the network later.
     */
    privateKey: PrivateKey;
}

/**
 * Extended account information from the mirror node.
 */
export interface MirrorAccountInfo {
    /** The account ID */
    accountId: string;
    /** The EVM address */
    evmAddress?: string;
    /** The public key */
    key?: string;
    /** Account balance in tinybars */
    balance: number;
    /** Whether the account has been deleted */
    deleted: boolean;
    /** Auto-renewal period in seconds */
    autoRenewPeriod?: number;
    /** Memo associated with the account */
    memo?: string;
    /** Maximum automatic token associations */
    maxAutomaticTokenAssociations?: number;
    /** Staking info */
    stakedAccountId?: string;
    stakedNodeId?: number;
    stakePeriodStart?: string;
    /** Account creation timestamp */
    createdTimestamp?: string;
    /** Expiration timestamp */
    expirationTimestamp?: string;
}
