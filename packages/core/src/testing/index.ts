/**
 * Test helpers for @hiero-enterprise/core.
 *
 * Provides mocks and utilities for testing applications
 * that use Hiero services without connecting to a real network.
 */

import type { HieroConfig } from "../config/index.js";
import type { MirrorNodeClient } from "../mirror/index.js";
import type {
    AccountInfo,
    Balance,
    Nft,
    Page,
    TokenInfo,
    TopicMessage,
    TransactionInfo,
    ExchangeRates,
    NetworkStake,
    NetworkSupplies,
} from "../data/index.js";

/**
 * A test-friendly HieroConfig with default values.
 */
export const testConfig: HieroConfig = {
    network: "testnet",
    operatorId: "0.0.1001",
    operatorKey:
        "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208",
    mirrorNodeUrl: "http://localhost:5551",
};

/**
 * Create a no-op MirrorNodeClient mock.
 * Each method returns a sensible empty/default value.
 */
export function createMockMirrorNodeClient(): MockMirrorNodeClient {
    return {
        queryAccount: async () => createMockAccountInfo(),
        queryAccountBalance: async () => createMockBalance(),
        queryNftsByAccount: async () => emptyPage(),
        queryNftsByTokenId: async () => emptyPage(),
        queryNftsByTokenIdAndSerial: async () => createMockNft(),
        queryNftsByAccountAndTokenId: async () => emptyPage(),
        queryTokenById: async () => createMockTokenInfo(),
        queryTokensByAccountId: async () => emptyPage(),
        queryTopicMessages: async () => emptyPage(),
        queryTopicMessageBySequence: async () => createMockTopicMessage(),
        queryTransactionsByAccount: async () => emptyPage(),
        queryTransactionsByAccountAndType: async () => emptyPage(),
        queryTransaction: async () => createMockTransactionInfo(),
        queryExchangeRates: async () => createMockExchangeRates(),
        queryNetworkSupplies: async () => createMockNetworkSupplies(),
        queryNetworkStake: async () => createMockNetworkStake(),
        fetchNextPage: async () => emptyPage(),
    };
}

type MockMirrorNodeClient = {
    [K in keyof MirrorNodeClient]: MirrorNodeClient[K];
};

// ─── Factory Functions ─────────────────────────────────────────

function emptyPage<T>(): Page<T> {
    return { data: [], links: { next: null } };
}

function createMockAccountInfo(): AccountInfo {
    return {
        accountId: "0.0.12345",
        balance: 100_000_000,
        deleted: false,
    };
}

function createMockBalance(): Balance {
    return {
        accountId: "0.0.12345",
        hbars: 100_000_000,
        tokens: [],
    };
}

function createMockNft(): Nft {
    return {
        tokenId: "0.0.99999",
        serialNumber: 1,
        accountId: "0.0.12345",
        metadata: "",
        deleted: false,
    };
}

function createMockTokenInfo(): TokenInfo {
    return {
        tokenId: "0.0.99999",
        name: "TestToken",
        symbol: "TST",
        type: "FUNGIBLE_COMMON",
        decimals: 2,
        totalSupply: "1000000",
        maxSupply: "0",
        treasuryAccountId: "0.0.12345",
        deleted: false,
        paused: false,
        customFees: [],
    };
}

function createMockTopicMessage(): TopicMessage {
    return {
        topicId: "0.0.88888",
        sequenceNumber: 1,
        message: "SGVsbG8=",
        runningHash: "",
        consensusTimestamp: "1234567890.000000000",
    };
}

function createMockTransactionInfo(): TransactionInfo {
    return {
        transactionId: "0.0.12345@1234567890.000000000",
        type: "CRYPTOTRANSFER",
        name: "CryptoTransfer",
        result: "SUCCESS",
        consensusTimestamp: "1234567890.000000000",
        validStartTimestamp: "1234567890.000000000",
        successful: true,
        chargedTxFee: 100000,
        transfers: [],
        tokenTransfers: [],
        nftTransfers: [],
        stakingRewardTransfers: [],
    };
}

function createMockExchangeRates(): ExchangeRates {
    return {
        currentRate: {
            hbarEquivalent: 30000,
            centEquivalent: 1200,
            expirationTime: "1234567890",
        },
        nextRate: {
            hbarEquivalent: 30000,
            centEquivalent: 1200,
            expirationTime: "1234567890",
        },
    };
}

function createMockNetworkSupplies(): NetworkSupplies {
    return {
        releasedSupply: "5000000000000000000",
        totalSupply: "5000000000000000000",
        timestamp: "1234567890.000000000",
    };
}

function createMockNetworkStake(): NetworkStake {
    return {
        maxStakeRewarded: 0,
        maxStakingRewardRatePerHbar: 0,
        maxTotalReward: 0,
        nodeRewardFeeFraction: 0,
        reservedStakingRewards: 0,
        rewardBalanceThreshold: 0,
        stakeTotal: 0,
        stakingPeriod: "",
        stakingPeriodDuration: 0,
        stakingPeriodsStored: 0,
        unreservedStakingRewardBalance: 0,
    };
}
