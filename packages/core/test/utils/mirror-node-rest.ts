/**
 * Thin Mirror Node REST helpers for integration tests.
 *
 * The SDK does not expose a typed REST client for the Mirror Node, so each
 * spec used to inline its own `fetch` call plus error handling.  These
 * helpers centralise the URL building, status checking, and JSON parsing so
 * every integration test can assert against the Mirror Node uniformly.
 *
 * Reads `HIERO_MIRROR_NODE_URL` from the environment (loaded by
 * `test/utils/setup-env.ts`). The lookup is deferred until first call so it
 * happens after the vitest setup file has populated `process.env`.
 */

function getMirrorUrl(): string {
    const url = process.env.HIERO_MIRROR_NODE_URL;
    if (!url) {
        throw new Error(
            "HIERO_MIRROR_NODE_URL is not set (required for Mirror Node REST integration tests).",
        );
    }
    return url;
}

export interface MirrorAllowance {
    owner: string;
    spender: string;
    amount?: number;
    token_id?: string;
}

export interface MirrorNftRecord {
    spender?: string | null;
    token_id?: string;
    serial_number?: number;
    account_id?: string;
    /** Base64-encoded metadata bytes (Mirror Node REST format). */
    metadata?: string;
}

export interface MirrorAccountToken {
    token_id: string;
    balance: string;
    decimals?: number;
    freeze_status?: "NOT_APPLICABLE" | "FROZEN" | "UNFROZEN";
    kyc_status?: "NOT_APPLICABLE" | "GRANTED" | "REVOKED";
}

export interface MirrorTokenInfo {
    token_id: string;
    name?: string;
    symbol?: string;
    memo?: string;
    treasury_account_id?: string;
    auto_renew_account?: string | null;
    decimals?: string | number;
    type?: string;
    supply_type?: string;
    total_supply?: string;
    deleted?: boolean;
    pause_status?: "NOT_APPLICABLE" | "PAUSED" | "UNPAUSED";
    custom_fees?: MirrorCustomFeesResponse;
}

export interface MirrorCustomFeesResponse {
    created_timestamp?: string;
    fixed_fees?: MirrorFixedFeeResponse[];
    fractional_fees?: MirrorFractionalFeeResponse[];
    royalty_fees?: MirrorRoyaltyFeeResponse[];
}

export interface MirrorFixedFeeResponse {
    amount: number;
    collector_account_id: string;
    all_collectors_are_exempt?: boolean;
    denominating_token_id?: string | null;
}

export interface MirrorFractionalFeeResponse {
    numerator: number;
    denominator: number;
    minimum?: number;
    maximum?: number;
    net_of_transfers?: boolean;
    collector_account_id: string;
    all_collectors_are_exempt?: boolean;
}

export interface MirrorRoyaltyFeeResponse {
    numerator: number;
    denominator: number;
    fallback_fee?: {
        amount: number;
        denominating_token_id?: string | null;
    };
    collector_account_id: string;
    all_collectors_are_exempt?: boolean;
}

export interface MirrorContractInfo {
    contract_id: string;
    memo?: string;
    auto_renew_account?: string | null;
    auto_renew_period?: number | null;
    expiration_timestamp?: string | null;
    file_id?: string | null;
    evm_address?: string | null;
    max_automatic_token_associations?: number | null;
    decline_reward?: boolean | null;
    staked_account_id?: string | null;
    staked_node_id?: number | null;
    deleted?: boolean;
    admin_key?: {
        _type: string;
        key: string;
    } | null;
}

async function getJson<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(
            `Mirror Node GET ${url} failed with status ${res.status}: ${await res.text()}`,
        );
    }
    return (await res.json()) as T;
}

/**
 * Fetch HBAR (crypto) allowances granted by `ownerAccountId`.
 */
export async function queryHbarAllowances(
    ownerAccountId: string,
): Promise<MirrorAllowance[]> {
    const data = await getJson<{ allowances?: MirrorAllowance[] }>(
        `${getMirrorUrl()}/api/v1/accounts/${ownerAccountId}/allowances/crypto`,
    );
    return data.allowances ?? [];
}

/**
 * Fetch fungible token allowances granted by `ownerAccountId`.
 */
export async function queryTokenAllowances(
    ownerAccountId: string,
): Promise<MirrorAllowance[]> {
    const data = await getJson<{ allowances?: MirrorAllowance[] }>(
        `${getMirrorUrl()}/api/v1/accounts/${ownerAccountId}/allowances/tokens`,
    );
    return data.allowances ?? [];
}

/**
 * Fetch the per-serial NFT record. Per-serial spender approvals appear on
 * the NFT itself rather than the owner-account allowances view.
 */
export async function queryNftRecord(
    tokenId: string,
    serial: number,
): Promise<MirrorNftRecord> {
    return getJson<MirrorNftRecord>(
        `${getMirrorUrl()}/api/v1/tokens/${tokenId}/nfts/${serial}`,
    );
}

/**
 * Fetch token relationships for an account.
 */
export async function queryAccountTokens(
    accountId: string,
): Promise<MirrorAccountToken[]> {
    const data = await getJson<{ tokens?: MirrorAccountToken[] }>(
        `${getMirrorUrl()}/api/v1/accounts/${accountId}/tokens`,
    );
    return data.tokens ?? [];
}

/**
 * Fetch token info by ID. Used to verify token-update integration tests
 * — `name`, `symbol`, `memo`, `treasury_account_id`, and `auto_renew_account`
 * are all observable via the Mirror Node after the consensus node propagates.
 */
export async function queryTokenInfo(
    tokenId: string,
): Promise<MirrorTokenInfo> {
    return getJson<MirrorTokenInfo>(
        `${getMirrorUrl()}/api/v1/tokens/${tokenId}`,
    );
}

/**
 * Fetch contract info by ID. Used to verify contract-update integration tests
 * — `memo`, `auto_renew_account`, `auto_renew_period`, `expiration_timestamp`,
 * `max_automatic_token_associations`, `decline_reward`, and staking targets are
 * all observable via the Mirror Node after the consensus node propagates.
 */
export async function queryContractInfo(
    contractId: string,
): Promise<MirrorContractInfo> {
    return getJson<MirrorContractInfo>(
        `${getMirrorUrl()}/api/v1/contracts/${contractId}`,
    );
}
