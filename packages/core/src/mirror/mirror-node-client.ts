import type {
    MirrorAccountInfo,
    Balance,
    Nft,
    MirrorTokenInfo,
    MirrorTopicMessage,
    TransactionInfo,
    ExchangeRates,
    NetworkStake,
    NetworkSupplies,
    Page,
    MirrorPageResponse,
    MirrorAccountResponse,
    MirrorNft,
    MirrorTokenResponse,
    MirrorTopicMessageRaw,
    MirrorTransaction,
    MirrorTransactionListResponse,
    MirrorExchangeRatesResponse,
    MirrorNetworkSupplyResponse,
    MirrorNetworkStakeResponse,
} from "../types/index.js";
import { HieroError, HieroErrorCodes } from "../errors/index.js";
import {
    convertPage,
    convertAccountInfo,
    convertBalance,
    convertNft,
    convertTokenInfo,
    convertTopicMessage,
    convertTransactionInfo,
    convertExchangeRate,
    convertNetworkStake,
} from "./mirror-node-converters.js";
import {
    assertPageResponse,
    assertAccountResponse,
    assertNftResponse,
    assertTokenResponse,
    assertTopicMessageResponse,
    assertTransactionListResponse,
    assertTransactionResponse,
    assertExchangeRatesResponse,
    assertNetworkSupplyResponse,
    assertNetworkStakeResponse,
} from "./mirror-node-validators.js";

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse the HTTP `Retry-After` header. Supports both the delta-seconds
 * format (`120`) and HTTP-date format (`Wed, 21 Oct 2026 07:28:00 GMT`).
 * Returns the delay in milliseconds, or `null` if the header is absent
 * or unparseable.
 */
function parseRetryAfter(header: string | null): number | null {
    if (!header) return null;
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.floor(seconds * 1000);
    }
    const dateMs = Date.parse(header);
    if (Number.isFinite(dateMs)) {
        return Math.max(0, dateMs - Date.now());
    }
    return null;
}

/**
 * HTTP client for querying the Hiero Mirror Node REST API.
 */
export class MirrorNodeClient {
    private readonly baseUrl: string;
    private readonly timeoutMs: number;
    private readonly maxRetries: number;

    constructor(
        baseUrl: string,
        options?: { timeoutMs?: number; maxRetries?: number },
    ) {
        // Remove trailing slashes
        let url = baseUrl;
        while (url.endsWith("/")) {
            url = url.slice(0, -1);
        }
        this.baseUrl = url;
        this.timeoutMs = options?.timeoutMs ?? 10_000;
        this.maxRetries = options?.maxRetries ?? 3;
    }

    // ─── HTTP Helper ─────────────────────────────────────────────

    /**
     * Issue a GET against the mirror node with timeout + retry semantics.
     *
     * - Each attempt is bounded by `timeoutMs` via AbortController.
     * - HTTP 429 and 5xx responses are retried up to `maxRetries` times,
     *   honouring the `Retry-After` header when present.
     * - Network errors (including AbortError caused by timeout) are
     *   retried with exponential backoff, then surfaced as HieroError.
     */
    private async fetch<T>(path: string, attempt = 0): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        let response: Response;
        try {
            response = await fetch(url, { signal: controller.signal });
        } catch (err) {
            clearTimeout(timer);
            const isAbort =
                err instanceof Error &&
                (err.name === "AbortError" || err.name === "TimeoutError");

            // Only retry timeouts here. Generic network errors (DNS, ECONNREFUSED)
            // are surfaced immediately — they almost always indicate a misconfigured
            // base URL rather than a transient blip.
            if (isAbort && attempt < this.maxRetries) {
                await sleep(this.backoffMs(attempt));
                return this.fetch<T>(path, attempt + 1);
            }

            throw new HieroError(
                isAbort
                    ? `Mirror node request timed out after ${this.timeoutMs}ms: ${url}`
                    : `Mirror node request failed: ${url}`,
                {
                    code: isAbort
                        ? HieroErrorCodes.TimedOut
                        : HieroErrorCodes.MirrorNodeError,
                    context: path,
                    cause: err instanceof Error ? err : undefined,
                },
            );
        }
        clearTimeout(timer);

        if (
            (response.status === 429 || response.status >= 500) &&
            attempt < this.maxRetries
        ) {
            const retryAfter = parseRetryAfter(
                response.headers.get("retry-after"),
            );
            await sleep(retryAfter ?? this.backoffMs(attempt));
            return this.fetch<T>(path, attempt + 1);
        }

        if (!response.ok) {
            throw new HieroError(
                `Mirror node returned ${response.status}: ${response.statusText}`,
                {
                    code: HieroErrorCodes.MirrorNodeHttpError,
                    context: path,
                },
            );
        }
        return response.json() as Promise<T>;
    }

    private backoffMs(attempt: number): number {
        // Exponential backoff with jitter: 100, 200, 400, 800, … ms, capped at 5s.
        const base = Math.min(5_000, 100 * 2 ** attempt);
        return base + Math.floor(Math.random() * 100);
    }

    // ─── Accounts ────────────────────────────────────────────────

    async queryAccount(accountId: string): Promise<MirrorAccountInfo> {
        const raw = await this.fetch<MirrorAccountResponse>(
            `/api/v1/accounts/${accountId}`,
        );
        assertAccountResponse(raw, `/api/v1/accounts/${accountId}`);
        return convertAccountInfo(raw);
    }

    async queryAccountBalance(accountId: string): Promise<Balance> {
        const raw = await this.fetch<MirrorAccountResponse>(
            `/api/v1/accounts/${accountId}`,
        );
        assertAccountResponse(raw, `/api/v1/accounts/${accountId}`);
        return convertBalance(accountId, raw);
    }

    // ─── NFTs ────────────────────────────────────────────────────

    async queryNftsByAccount(accountId: string): Promise<Page<Nft>> {
        const raw = await this.fetch<MirrorPageResponse<MirrorNft>>(
            `/api/v1/accounts/${accountId}/nfts`,
        );
        assertPageResponse(raw, `/api/v1/accounts/${accountId}/nfts`);
        return convertPage(raw, convertNft);
    }

    async queryNftsByTokenId(tokenId: string): Promise<Page<Nft>> {
        const raw = await this.fetch<MirrorPageResponse<MirrorNft>>(
            `/api/v1/tokens/${tokenId}/nfts`,
        );
        assertPageResponse(raw, `/api/v1/tokens/${tokenId}/nfts`);
        return convertPage(raw, convertNft);
    }

    async queryNftsByTokenIdAndSerial(
        tokenId: string,
        serialNumber: number,
    ): Promise<Nft> {
        const raw = await this.fetch<MirrorNft>(
            `/api/v1/tokens/${tokenId}/nfts/${serialNumber}`,
        );
        assertNftResponse(
            raw,
            `/api/v1/tokens/${tokenId}/nfts/${serialNumber}`,
        );
        return convertNft(raw);
    }

    async queryNftsByAccountAndTokenId(
        accountId: string,
        tokenId: string,
    ): Promise<Page<Nft>> {
        const raw = await this.fetch<MirrorPageResponse<MirrorNft>>(
            `/api/v1/accounts/${accountId}/nfts?token.id=${tokenId}`,
        );
        assertPageResponse(
            raw,
            `/api/v1/accounts/${accountId}/nfts?token.id=${tokenId}`,
        );
        return convertPage(raw, convertNft);
    }

    // ─── Tokens ──────────────────────────────────────────────────

    async queryTokenById(tokenId: string): Promise<MirrorTokenInfo> {
        const raw = await this.fetch<MirrorTokenResponse>(
            `/api/v1/tokens/${tokenId}`,
        );
        assertTokenResponse(raw, `/api/v1/tokens/${tokenId}`);
        return convertTokenInfo(raw);
    }

    async queryTokensByAccountId(
        accountId: string,
    ): Promise<Page<MirrorTokenInfo>> {
        // The mirror node exposes token relationships via balances
        const raw = await this.fetch<MirrorPageResponse<MirrorTokenResponse>>(
            `/api/v1/tokens?account.id=${accountId}`,
        );
        assertPageResponse(raw, `/api/v1/tokens?account.id=${accountId}`);
        return convertPage(raw, convertTokenInfo);
    }

    // ─── Topics ──────────────────────────────────────────────────

    async queryTopicMessages(
        topicId: string,
    ): Promise<Page<MirrorTopicMessage>> {
        const raw = await this.fetch<MirrorPageResponse<MirrorTopicMessageRaw>>(
            `/api/v1/topics/${topicId}/messages`,
        );
        assertPageResponse(raw, `/api/v1/topics/${topicId}/messages`);
        return convertPage(raw, convertTopicMessage);
    }

    async queryTopicMessageBySequence(
        topicId: string,
        sequenceNumber: number,
    ): Promise<MirrorTopicMessage> {
        const raw = await this.fetch<MirrorTopicMessageRaw>(
            `/api/v1/topics/${topicId}/messages/${sequenceNumber}`,
        );
        assertTopicMessageResponse(
            raw,
            `/api/v1/topics/${topicId}/messages/${sequenceNumber}`,
        );
        return convertTopicMessage(raw);
    }

    // ─── Transactions ────────────────────────────────────────────

    async queryTransactionsByAccount(
        accountId: string,
    ): Promise<Page<TransactionInfo>> {
        const raw = await this.fetch<MirrorPageResponse<MirrorTransaction>>(
            `/api/v1/transactions?account.id=${accountId}`,
        );
        assertPageResponse(raw, `/api/v1/transactions?account.id=${accountId}`);
        return convertPage(raw, convertTransactionInfo);
    }

    async queryTransactionsByAccountAndType(
        accountId: string,
        type: string,
    ): Promise<Page<TransactionInfo>> {
        const raw = await this.fetch<MirrorPageResponse<MirrorTransaction>>(
            `/api/v1/transactions?account.id=${accountId}&transactiontype=${type}`,
        );
        assertPageResponse(
            raw,
            `/api/v1/transactions?account.id=${accountId}&transactiontype=${type}`,
        );
        return convertPage(raw, convertTransactionInfo);
    }

    async queryTransaction(transactionId: string): Promise<TransactionInfo> {
        const raw = await this.fetch<MirrorTransactionListResponse>(
            `/api/v1/transactions/${transactionId}`,
        );
        assertTransactionListResponse(
            raw,
            `/api/v1/transactions/${transactionId}`,
        );
        if (!raw.transactions || raw.transactions.length === 0) {
            throw new HieroError(`Transaction not found: ${transactionId}`, {
                code: HieroErrorCodes.NotFound,
            });
        }
        assertTransactionResponse(
            raw.transactions[0],
            `/api/v1/transactions/${transactionId}`,
        );
        return convertTransactionInfo(raw.transactions[0]);
    }

    // ─── Network ─────────────────────────────────────────────────

    async queryExchangeRates(): Promise<ExchangeRates> {
        const raw = await this.fetch<MirrorExchangeRatesResponse>(
            "/api/v1/network/exchangerate",
        );
        assertExchangeRatesResponse(raw, "/api/v1/network/exchangerate");
        return {
            currentRate: convertExchangeRate(raw.current_rate),
            nextRate: convertExchangeRate(raw.next_rate),
        };
    }

    async queryNetworkSupplies(): Promise<NetworkSupplies> {
        const raw = await this.fetch<MirrorNetworkSupplyResponse>(
            "/api/v1/network/supply",
        );
        assertNetworkSupplyResponse(raw, "/api/v1/network/supply");
        return {
            releasedSupply: raw.released_supply,
            totalSupply: raw.total_supply,
            timestamp: raw.timestamp,
        };
    }

    async queryNetworkStake(): Promise<NetworkStake> {
        const raw = await this.fetch<MirrorNetworkStakeResponse>(
            "/api/v1/network/stake",
        );
        assertNetworkStakeResponse(raw, "/api/v1/network/stake");
        return convertNetworkStake(raw);
    }

    // ─── Pagination ──────────────────────────────────────────────

    /**
     * Fetch the next page of results using a pagination link.
     */
    async fetchNextPage<T>(
        nextLink: string,
        converter: (raw: unknown) => T,
    ): Promise<Page<T>> {
        const raw = await this.fetch<MirrorPageResponse<unknown>>(nextLink);
        assertPageResponse(raw, nextLink);
        return convertPage(raw, converter);
    }
}
