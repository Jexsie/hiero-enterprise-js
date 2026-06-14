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
