import type { MirrorNodeClient } from "../../src/mirror/index.js";
import type {
    MirrorAccountInfo,
    Balance,
    Nft,
    Page,
    MirrorTokenInfo,
    MirrorTopicMessage,
    TransactionInfo,
    ExchangeRates,
    NetworkStake,
    NetworkSupplies,
} from "../../src/types/index.js";

/**
 * Create a no-op MirrorNodeClient mock for unit tests.
 * Each method returns a sensible empty/default value.
 */
export function createMockMirrorNodeClient(): MockMirrorNodeClient {
    return {
        queryAccount: () => Promise.resolve(accountInfo()),
        queryAccountBalance: () => Promise.resolve(balance()),
        queryNftsByAccount: () => Promise.resolve(emptyPage()),
        queryNftsByTokenId: () => Promise.resolve(emptyPage()),
        queryNftsByTokenIdAndSerial: () => Promise.resolve(nft()),
        queryNftsByAccountAndTokenId: () => Promise.resolve(emptyPage()),
        queryTokenById: () => Promise.resolve(tokenInfo()),
        queryTokensByAccountId: () => Promise.resolve(emptyPage()),
        queryTopicMessages: () => Promise.resolve(emptyPage()),
        queryTopicMessageBySequence: () => Promise.resolve(topicMessage()),
        queryTransactionsByAccount: () => Promise.resolve(emptyPage()),
        queryTransactionsByAccountAndType: () => Promise.resolve(emptyPage()),
        queryTransaction: () => Promise.resolve(transactionInfo()),
        queryExchangeRates: () => Promise.resolve(exchangeRates()),
        queryNetworkSupplies: () => Promise.resolve(networkSupplies()),
        queryNetworkStake: () => Promise.resolve(networkStake()),
        fetchNextPage: () => Promise.resolve(emptyPage()),
    };
}

type MockMirrorNodeClient = {
    [K in keyof MirrorNodeClient]: MirrorNodeClient[K];
};

function emptyPage<T>(): Page<T> {
    return { data: [], links: { next: null } };
}

function accountInfo(): MirrorAccountInfo {
    return {
        accountId: "0.0.12345",
        balance: 100_000_000,
        deleted: false,
    };
}

function balance(): Balance {
    return {
        accountId: "0.0.12345",
        hbars: "100000000",
        tokens: [],
    };
}

function nft(): Nft {
    return {
        tokenId: "0.0.99999",
        serialNumber: 1,
        accountId: "0.0.12345",
        metadata: "",
        deleted: false,
    };
}

function tokenInfo(): MirrorTokenInfo {
    return {
        tokenId: "0.0.99999",
        name: "Test Token",
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

function topicMessage(): MirrorTopicMessage {
    return {
        topicId: "0.0.88888",
        sequenceNumber: "1",
        message: "",
        runningHash: "",
        consensusTimestamp: "1234567890.000000000",
    };
}

function transactionInfo(): TransactionInfo {
    return {
        transactionId: "0.0.12345@1234567890.000000000",
        type: "CRYPTOTRANSFER",
        name: "cryptotransfer",
        result: "SUCCESS",
        consensusTimestamp: "1234567890.000000001",
        validStartTimestamp: "1234567890.000000000",
        successful: true,
        chargedTxFee: 100000,
        transfers: [],
        tokenTransfers: [],
        nftTransfers: [],
        stakingRewardTransfers: [],
    };
}

function exchangeRates(): ExchangeRates {
    return {
        currentRate: {
            hbarEquivalent: 30000,
            centEquivalent: 120000,
            expirationTime: "1234567890",
        },
        nextRate: {
            hbarEquivalent: 30000,
            centEquivalent: 120000,
            expirationTime: "1234567890",
        },
    };
}

function networkSupplies(): NetworkSupplies {
    return {
        releasedSupply: "5000000000000000000",
        totalSupply: "5000000000000000000",
        timestamp: "1234567890.000000000",
    };
}

function networkStake(): NetworkStake {
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
