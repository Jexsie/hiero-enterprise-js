/**
 * The key algorithm type for the account.
 */
export enum AccountType {
    ED25519 = "ed25519",
    ECDSA = "ecdsa",
}

/**
 * The encoding/algorithm type for the operator private key.
 * Used when parsing the operator key material from configuration.
 */
export enum OperatorKeyType {
    ED25519 = "ed25519",
    ECDSA = "ecdsa",
    DER = "der",
}

/**
 * Represents a Hiero network account.
 */
export interface Account {
    /** The account ID (e.g., "0.0.12345") */
    accountId: string;
    /** The public key associated with the account */
    publicKey?: string;
    /** The EVM address derived from the public key */
    evmAddress?: string;
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
