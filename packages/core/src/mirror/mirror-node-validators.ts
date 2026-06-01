import { HieroError, HieroErrorCodes } from "../errors/index.js";
import type {
    MirrorAccountResponse,
    MirrorExchangeRatesResponse,
    MirrorNetworkStakeResponse,
    MirrorNetworkSupplyResponse,
    MirrorNft,
    MirrorPageResponse,
    MirrorTokenResponse,
    MirrorTopicMessageRaw,
    MirrorTransaction,
    MirrorTransactionListResponse,
} from "../types/index.js";

// ─── Top-level response assertions ──────────────────────────────

export function assertPageResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorPageResponse<unknown> {
    assertObject(raw, path);
    const hasDataArray = Object.entries(raw).some(
        ([key, value]) => key !== "links" && Array.isArray(value),
    );
    if (!hasDataArray) {
        throw mismatch(path, "expected a paged array payload");
    }
}

export function assertAccountResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorAccountResponse {
    assertObject(raw, path);
    assertField(raw, "account", "string", path);
}

export function assertNftResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorNft {
    assertObject(raw, path);
    assertField(raw, "token_id", "string", path);
    assertField(raw, "serial_number", "number", path);
}

export function assertTokenResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorTokenResponse {
    assertObject(raw, path);
    assertField(raw, "token_id", "string", path);
}

export function assertTopicMessageResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorTopicMessageRaw {
    assertObject(raw, path);
    assertField(raw, "topic_id", "string", path);
    assertField(raw, "sequence_number", "number", path);
}

export function assertTransactionListResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorTransactionListResponse {
    assertObject(raw, path);
    if (!Array.isArray(raw.transactions)) {
        throw mismatch(path, "expected transactions array");
    }
}

export function assertTransactionResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorTransaction {
    assertObject(raw, path);
    assertField(raw, "transaction_id", "string", path);
}

export function assertExchangeRatesResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorExchangeRatesResponse {
    assertObject(raw, path);
    assertObject(raw.current_rate, `${path}.current_rate`);
    assertObject(raw.next_rate, `${path}.next_rate`);
}

export function assertNetworkSupplyResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorNetworkSupplyResponse {
    assertObject(raw, path);
    assertField(raw, "released_supply", "string", path);
    assertField(raw, "total_supply", "string", path);
}

export function assertNetworkStakeResponse(
    raw: unknown,
    path: string,
): asserts raw is MirrorNetworkStakeResponse {
    assertObject(raw, path);
    assertField(raw, "max_stake_rewarded", "number", path);
}

// ─── Primitive assertions ────────────────────────────────────────

function assertObject(
    value: unknown,
    path: string,
): asserts value is Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw mismatch(path, "expected a JSON object");
    }
}

function assertField(
    obj: Record<string, unknown>,
    field: string,
    expectedType: "string" | "number" | "boolean",
    path: string,
): void {
    if (typeof obj[field] !== expectedType) {
        throw mismatch(
            `${path}.${field}`,
            `expected ${expectedType}, got ${typeof obj[field]}`,
        );
    }
}

function mismatch(path: string, detail: string): HieroError {
    return new HieroError(
        `Mirror node response schema mismatch at ${path}: ${detail}.`,
        { code: HieroErrorCodes.MirrorNodeSchemaMismatch, context: path },
    );
}
