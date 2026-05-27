import type {
    MirrorAccountInfo,
    Balance,
    TokenBalance,
    Nft,
    MirrorTokenInfo,
    MirrorTopicMessage,
    TransactionInfo,
    Transfer,
    TokenTransferInfo,
    NftTransferInfo,
    StakingRewardTransfer,
    ExchangeRates,
    ExchangeRate,
    NetworkStake,
    NetworkSupplies,
    Page,
    MirrorCustomFee,
    MirrorFixedFee,
    MirrorFractionalFee,
    MirrorRoyaltyFee,
    MirrorPageResponse,
    MirrorAccountResponse,
    MirrorNft,
    MirrorTokenResponse,
    MirrorTopicMessageRaw,
    MirrorTransaction,
    MirrorTransfer,
    MirrorTokenTransfer,
    MirrorNftTransfer,
    MirrorStakingRewardTransfer,
    MirrorTransactionListResponse,
    MirrorExchangeRatesResponse,
    MirrorExchangeRate,
    MirrorNetworkSupplyResponse,
    MirrorNetworkStakeResponse,
} from "../types/index.js";
import { HieroError } from "../errors/index.js";

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
                    code: isAbort ? "TIMED_OUT" : "MIRROR_NODE_ERROR",
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
                { code: "MIRROR_NODE_HTTP_ERROR", context: path },
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
        return convertAccountInfo(raw);
    }

    async queryAccountBalance(accountId: string): Promise<Balance> {
        const raw = await this.fetch<MirrorAccountResponse>(
            `/api/v1/accounts/${accountId}`,
        );
        return convertBalance(accountId, raw);
    }

    // ─── NFTs ────────────────────────────────────────────────────

    async queryNftsByAccount(accountId: string): Promise<Page<Nft>> {
        const raw = await this.fetch<MirrorPageResponse<MirrorNft>>(
            `/api/v1/accounts/${accountId}/nfts`,
        );
        return convertPage(raw, convertNft);
    }

    async queryNftsByTokenId(tokenId: string): Promise<Page<Nft>> {
        const raw = await this.fetch<MirrorPageResponse<MirrorNft>>(
            `/api/v1/tokens/${tokenId}/nfts`,
        );
        return convertPage(raw, convertNft);
    }

    async queryNftsByTokenIdAndSerial(
        tokenId: string,
        serialNumber: number,
    ): Promise<Nft> {
        const raw = await this.fetch<MirrorNft>(
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
        return convertPage(raw, convertNft);
    }

    // ─── Tokens ──────────────────────────────────────────────────

    async queryTokenById(tokenId: string): Promise<MirrorTokenInfo> {
        const raw = await this.fetch<MirrorTokenResponse>(
            `/api/v1/tokens/${tokenId}`,
        );
        return convertTokenInfo(raw);
    }

    async queryTokensByAccountId(
        accountId: string,
    ): Promise<Page<MirrorTokenInfo>> {
        // The mirror node exposes token relationships via balances
        const raw = await this.fetch<MirrorPageResponse<MirrorTokenResponse>>(
            `/api/v1/tokens?account.id=${accountId}`,
        );
        return convertPage(raw, convertTokenInfo);
    }

    // ─── Topics ──────────────────────────────────────────────────

    async queryTopicMessages(
        topicId: string,
    ): Promise<Page<MirrorTopicMessage>> {
        const raw = await this.fetch<MirrorPageResponse<MirrorTopicMessageRaw>>(
            `/api/v1/topics/${topicId}/messages`,
        );
        return convertPage(raw, convertTopicMessage);
    }

    async queryTopicMessageBySequence(
        topicId: string,
        sequenceNumber: number,
    ): Promise<MirrorTopicMessage> {
        const raw = await this.fetch<MirrorTopicMessageRaw>(
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
        return convertPage(raw, convertTransactionInfo);
    }

    async queryTransactionsByAccountAndType(
        accountId: string,
        type: string,
    ): Promise<Page<TransactionInfo>> {
        const raw = await this.fetch<MirrorPageResponse<MirrorTransaction>>(
            `/api/v1/transactions?account.id=${accountId}&transactiontype=${type}`,
        );
        return convertPage(raw, convertTransactionInfo);
    }

    async queryTransaction(transactionId: string): Promise<TransactionInfo> {
        const raw = await this.fetch<MirrorTransactionListResponse>(
            `/api/v1/transactions/${transactionId}`,
        );
        if (!raw.transactions || raw.transactions.length === 0) {
            throw new HieroError(`Transaction not found: ${transactionId}`, {
                code: "NOT_FOUND",
            });
        }
        return convertTransactionInfo(raw.transactions[0]);
    }

    // ─── Network ─────────────────────────────────────────────────

    async queryExchangeRates(): Promise<ExchangeRates> {
        const raw = await this.fetch<MirrorExchangeRatesResponse>(
            "/api/v1/network/exchangerate",
        );
        return {
            currentRate: convertExchangeRate(raw.current_rate),
            nextRate: convertExchangeRate(raw.next_rate),
        };
    }

    async queryNetworkSupplies(): Promise<NetworkSupplies> {
        const raw = await this.fetch<MirrorNetworkSupplyResponse>(
            "/api/v1/network/supply",
        );
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
        return convertPage(raw, converter);
    }
}

// ─── Converters ────────────────────────────────────────────────

function convertPage<TRaw, TOut>(
    raw: MirrorPageResponse<TRaw>,
    converter: (item: TRaw) => TOut,
): Page<TOut> {
    // The mirror node returns arrays under different keys (nfts, tokens, messages, transactions)
    // Find the first array value that isn't 'links'
    const dataKey = Object.keys(raw).find(
        (k) => k !== "links" && Array.isArray(raw[k]),
    );
    const items = dataKey ? (raw[dataKey] as TRaw[]) : [];
    return {
        data: items.map(converter),
        links: { next: raw.links?.next ?? null },
    };
}

function convertAccountInfo(raw: MirrorAccountResponse): MirrorAccountInfo {
    return {
        accountId: raw.account,
        evmAddress: raw.evm_address,
        key: raw.key?.key,
        balance: raw.balance?.balance ?? 0,
        deleted: raw.deleted ?? false,
        autoRenewPeriod: raw.auto_renew_period,
        memo: raw.memo,
        maxAutomaticTokenAssociations: raw.max_automatic_token_associations,
        stakedAccountId: raw.staked_account_id,
        stakedNodeId: raw.staked_node_id,
        stakePeriodStart: raw.stake_period_start,
        createdTimestamp: raw.created_timestamp,
        expirationTimestamp: raw.expiry_timestamp,
    };
}

function convertBalance(
    accountId: string,
    raw: MirrorAccountResponse,
): Balance {
    const tokens: TokenBalance[] = (raw.balance?.tokens ?? []).map((t) => ({
        tokenId: t.token_id,
        balance: String(t.balance),
        decimals: t.decimals,
    }));
    return {
        accountId,
        hbars: String(raw.balance?.balance ?? 0),
        tokens,
    };
}

function convertNft(raw: MirrorNft): Nft {
    return {
        tokenId: raw.token_id,
        serialNumber: raw.serial_number,
        accountId: raw.account_id,
        metadata: raw.metadata,
        createdTimestamp: raw.created_timestamp,
        deleted: raw.deleted,
        delegatingSpender: raw.delegating_spender,
        spender: raw.spender,
    };
}

function convertTokenInfo(raw: MirrorTokenResponse): MirrorTokenInfo {
    const customFees: MirrorCustomFee[] = [];
    if (raw.custom_fees) {
        for (const f of raw.custom_fees.fixed_fees ?? []) {
            customFees.push({
                type: "fixed",
                amount: f.amount,
                collectorAccountId: f.collector_account_id,
                allCollectorsAreExempt: f.all_collectors_are_exempt,
                denominatingTokenId: f.denominating_token_id,
            } as MirrorFixedFee);
        }
        for (const f of raw.custom_fees.fractional_fees ?? []) {
            customFees.push({
                type: "fractional",
                numerator: f.numerator,
                denominator: f.denominator,
                min: f.minimum,
                max: f.maximum,
                netOfTransfers: f.net_of_transfers,
                collectorAccountId: f.collector_account_id,
                allCollectorsAreExempt: f.all_collectors_are_exempt,
            } as MirrorFractionalFee);
        }
        for (const f of raw.custom_fees.royalty_fees ?? []) {
            customFees.push({
                type: "royalty",
                numerator: f.numerator,
                denominator: f.denominator,
                fallbackFee: f.fallback_fee
                    ? {
                          amount: f.fallback_fee.amount,
                          denominatingTokenId:
                              f.fallback_fee.denominating_token_id,
                      }
                    : undefined,
                collectorAccountId: f.collector_account_id,
                allCollectorsAreExempt: f.all_collectors_are_exempt,
            } as MirrorRoyaltyFee);
        }
    }

    return {
        tokenId: raw.token_id,
        name: raw.name,
        symbol: raw.symbol,
        type:
            raw.type === "NON_FUNGIBLE_UNIQUE"
                ? "NON_FUNGIBLE_UNIQUE"
                : "FUNGIBLE_COMMON",
        decimals: parseInt(raw.decimals, 10),
        totalSupply: raw.total_supply,
        maxSupply: raw.max_supply,
        treasuryAccountId: raw.treasury_account_id,
        adminKey: raw.admin_key?.key,
        supplyKey: raw.supply_key?.key,
        freezeKey: raw.freeze_key?.key,
        wipeKey: raw.wipe_key?.key,
        kycKey: raw.kyc_key?.key,
        pauseKey: raw.pause_key?.key,
        feeScheduleKey: raw.fee_schedule_key?.key,
        deleted: raw.deleted,
        paused: raw.pause_status === "PAUSED",
        customFees,
        createdTimestamp: raw.created_timestamp,
        expirationTimestamp: raw.expiry_timestamp,
        memo: raw.memo,
    };
}

function convertTopicMessage(raw: MirrorTopicMessageRaw): MirrorTopicMessage {
    return {
        topicId: raw.topic_id,
        sequenceNumber: String(raw.sequence_number),
        message: raw.message,
        runningHash: raw.running_hash,
        consensusTimestamp: raw.consensus_timestamp,
        payerAccountId: raw.payer_account_id,
    };
}

function convertTransactionInfo(raw: MirrorTransaction): TransactionInfo {
    return {
        transactionId: raw.transaction_id,
        type: raw.name?.toUpperCase().replace(/ /g, "") ?? "",
        name: raw.name ?? "",
        result: raw.result,
        consensusTimestamp: raw.consensus_timestamp,
        validStartTimestamp: raw.valid_start_timestamp,
        successful: raw.result === "SUCCESS",
        chargedTxFee: raw.charged_tx_fee,
        memo: raw.memo_base64 ? atob(raw.memo_base64) : undefined,
        transfers: (raw.transfers ?? []).map(convertTransfer),
        tokenTransfers: (raw.token_transfers ?? []).map(convertTokenTransfer),
        nftTransfers: (raw.nft_transfers ?? []).map(convertNftTransfer),
        stakingRewardTransfers: (raw.staking_reward_transfers ?? []).map(
            convertStakingRewardTransfer,
        ),
    };
}

function convertTransfer(raw: MirrorTransfer): Transfer {
    return {
        accountId: raw.account,
        amount: raw.amount,
        isApproval: raw.is_approval,
    };
}

function convertTokenTransfer(raw: MirrorTokenTransfer): TokenTransferInfo {
    return {
        tokenId: raw.token_id,
        accountId: raw.account,
        amount: raw.amount,
    };
}

function convertNftTransfer(raw: MirrorNftTransfer): NftTransferInfo {
    return {
        tokenId: raw.token_id,
        serialNumber: raw.serial_number,
        senderAccountId: raw.sender_account_id,
        receiverAccountId: raw.receiver_account_id,
    };
}

function convertStakingRewardTransfer(
    raw: MirrorStakingRewardTransfer,
): StakingRewardTransfer {
    return {
        accountId: raw.account,
        amount: raw.amount,
    };
}

function convertExchangeRate(raw: MirrorExchangeRate): ExchangeRate {
    return {
        hbarEquivalent: raw.hbar_equivalent,
        centEquivalent: raw.cent_equivalent,
        expirationTime: String(raw.expiration_time),
    };
}

function convertNetworkStake(raw: MirrorNetworkStakeResponse): NetworkStake {
    return {
        maxStakeRewarded: raw.max_stake_rewarded,
        maxStakingRewardRatePerHbar: raw.max_staking_reward_rate_per_hbar,
        maxTotalReward: raw.max_total_reward,
        nodeRewardFeeFraction: raw.node_reward_fee_fraction,
        reservedStakingRewards: raw.reserved_staking_rewards,
        rewardBalanceThreshold: raw.reward_balance_threshold,
        stakeTotal: raw.stake_total,
        stakingPeriod: raw.staking_period,
        stakingPeriodDuration: raw.staking_period_duration,
        stakingPeriodsStored: raw.staking_periods_stored,
        unreservedStakingRewardBalance: raw.unreserved_staking_reward_balance,
    };
}
