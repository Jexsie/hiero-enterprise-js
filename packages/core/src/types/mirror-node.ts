export interface MirrorPageResponse<_T> {
    [key: string]: unknown;
    links?: { next: string | null };
}

export interface MirrorAccountResponse {
    account: string;
    alias?: string;
    evm_address?: string;
    key?: { key: string };
    balance?: { balance: number; tokens: MirrorTokenBalance[] };
    deleted?: boolean;
    auto_renew_period?: number;
    memo?: string;
    max_automatic_token_associations?: number;
    staked_account_id?: string;
    staked_node_id?: number;
    stake_period_start?: string;
    created_timestamp?: string;
    expiry_timestamp?: string;
}

export interface MirrorTokenBalance {
    token_id: string;
    balance: number;
    decimals: number;
}

export interface MirrorNft {
    token_id: string;
    serial_number: number;
    account_id: string;
    metadata: string;
    created_timestamp?: string;
    deleted: boolean;
    delegating_spender?: string;
    spender?: string;
}

export interface MirrorTokenResponse {
    token_id: string;
    name: string;
    symbol: string;
    type: string;
    decimals: string;
    total_supply: string;
    max_supply: string;
    treasury_account_id: string;
    admin_key?: { key: string };
    supply_key?: { key: string };
    freeze_key?: { key: string };
    wipe_key?: { key: string };
    kyc_key?: { key: string };
    pause_key?: { key: string };
    fee_schedule_key?: { key: string };
    deleted: boolean;
    pause_status?: string;
    custom_fees?: {
        fixed_fees?: MirrorFixedFeeRaw[];
        fractional_fees?: MirrorFractionalFeeRaw[];
        royalty_fees?: MirrorRoyaltyFeeRaw[];
    };
    created_timestamp?: string;
    expiry_timestamp?: string;
    memo?: string;
}

export interface MirrorFixedFeeRaw {
    amount: number;
    collector_account_id: string;
    denominating_token_id?: string;
    all_collectors_are_exempt: boolean;
}

export interface MirrorFractionalFeeRaw {
    numerator: number;
    denominator: number;
    minimum?: number;
    maximum?: number;
    net_of_transfers: boolean;
    collector_account_id: string;
    all_collectors_are_exempt: boolean;
}

export interface MirrorRoyaltyFeeRaw {
    numerator: number;
    denominator: number;
    fallback_fee?: { amount: number; denominating_token_id?: string };
    collector_account_id: string;
    all_collectors_are_exempt: boolean;
}

export interface MirrorTopicMessageRaw {
    topic_id: string;
    sequence_number: number;
    message: string;
    running_hash: string;
    consensus_timestamp: string;
    payer_account_id?: string;
}

export interface MirrorTransaction {
    transaction_id: string;
    name: string;
    result: string;
    consensus_timestamp: string;
    valid_start_timestamp: string;
    charged_tx_fee: number;
    memo_base64?: string;
    transfers: MirrorTransfer[];
    token_transfers: MirrorTokenTransfer[];
    nft_transfers: MirrorNftTransfer[];
    staking_reward_transfers: MirrorStakingRewardTransfer[];
}

export interface MirrorTransfer {
    account: string;
    amount: number;
    is_approval: boolean;
}

export interface MirrorTokenTransfer {
    token_id: string;
    account: string;
    amount: number;
}

export interface MirrorNftTransfer {
    token_id: string;
    serial_number: number;
    sender_account_id: string;
    receiver_account_id: string;
}

export interface MirrorStakingRewardTransfer {
    account: string;
    amount: number;
}

export interface MirrorTransactionListResponse {
    transactions: MirrorTransaction[];
}

export interface MirrorExchangeRatesResponse {
    current_rate: MirrorExchangeRate;
    next_rate: MirrorExchangeRate;
}

export interface MirrorExchangeRate {
    cent_equivalent: number;
    hbar_equivalent: number;
    expiration_time: number;
}

export interface MirrorNetworkSupplyResponse {
    released_supply: string;
    total_supply: string;
    timestamp: string;
}

export interface MirrorNetworkStakeResponse {
    max_stake_rewarded: number;
    max_staking_reward_rate_per_hbar: number;
    max_total_reward: number;
    node_reward_fee_fraction: number;
    reserved_staking_rewards: number;
    reward_balance_threshold: number;
    stake_total: number;
    staking_period: string;
    staking_period_duration: number;
    staking_periods_stored: number;
    unreserved_staking_reward_balance: number;
}
