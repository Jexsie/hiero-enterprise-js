import type { AccountId } from "@hiero-ledger/sdk";
import type { Account, Balance } from "../../types/index.js";
import type { IHieroContext } from "../../context/index.js";
import { normalizeError } from "../../errors/index.js";
import {
    CreateAccountOperation,
    AutoCreateEvmAccountOperation,
    DeleteAccountOperation,
    UpdateAccountOperation,
    ApproveAllowanceOperation,
} from "./operations/index.js";
import type {
    CreateAccountOptions,
    AutoCreateEvmAccountOptions,
    DeleteAccountOptions,
    ScheduleDeleteAccountOptions,
    UpdateAccountOptions,
    ApproveHbarAllowanceOptions,
    ApproveTokenAllowanceOptions,
    ApproveNftAllowanceOptions,
} from "./operations/index.js";
import { AccountBalanceQuery } from "./queries/index.js";
import type { ScheduleOptions, ScheduledResult } from "../transaction/index.js";

/**
 * Service for managing accounts on the Hiero network.
 *
 */
export class AccountService {
    private readonly createOperation: CreateAccountOperation;
    private readonly autoCreateOperation: AutoCreateEvmAccountOperation;
    private readonly deleteOperation: DeleteAccountOperation;
    private readonly updateOperation: UpdateAccountOperation;
    private readonly approveAllowanceOperation: ApproveAllowanceOperation;
    private readonly balanceQuery: AccountBalanceQuery;

    constructor(private readonly context: IHieroContext) {
        this.createOperation = new CreateAccountOperation(context);
        this.autoCreateOperation = new AutoCreateEvmAccountOperation(context);
        this.deleteOperation = new DeleteAccountOperation(context);
        this.updateOperation = new UpdateAccountOperation(context);
        this.approveAllowanceOperation = new ApproveAllowanceOperation(context);
        this.balanceQuery = new AccountBalanceQuery(context);
    }

    /**
     * Create a new account on the network using a caller-provided public key.
     *
     * Key generation is the caller's responsibility (HSM, KMS, wallet, etc.).
     * This method accepts only the public key and submits the
     * `AccountCreateTransaction` to the network.
     *
     * @param options.publicKey - The public key hex string for the new account (mutually exclusive with `options.key`)
     * @param options.key - SDK `Key` instance (KeyList, threshold, etc.). Mutually exclusive with `options.publicKey`
     * @param options.keyType - Key algorithm: `AccountType.ED25519` or `AccountType.ECDSA`. Required when `publicKey` is a string
     * @param options.alias - `true` to derive EVM alias from key, or `{ ecdsaPublicKey }` for two-key pattern
     * @param options.initialBalance - Initial HBAR balance (default: 0)
     * @param options.receiverSignatureRequired - Require receiver sig for inbound transfers
     * @param options.memo - Account memo (max 100 bytes)
     * @param options.maxAutomaticTokenAssociations - Max auto token associations (0 = none, -1 = unlimited)
     * @param options.stakedAccountId - Account ID to stake to (mutually exclusive with stakedNodeId)
     * @param options.stakedNodeId - Node ID to stake to (mutually exclusive with stakedAccountId)
     * @param options.declineStakingReward - Whether to decline staking rewards
     * @returns The created account (ID, public key, and optional EVM address)
     */
    createAccount(options: CreateAccountOptions): Promise<Account> {
        return this.createOperation.execute(options);
    }

    /**
     * Schedule account creation instead of executing immediately.
     * Returns a `scheduleId` — other parties can then sign via `ScheduleSignTransaction`.
     *
     * @param options.publicKey - The public key hex string for the new account (mutually exclusive with `options.key`)
     * @param options.key - SDK `Key` instance (KeyList, threshold, etc.). Mutually exclusive with `options.publicKey`
     * @param options.keyType - Key algorithm: `AccountType.ED25519` or `AccountType.ECDSA`. Required when `publicKey` is a string
     * @param options.alias - `true` to derive EVM alias from key, or `{ ecdsaPublicKey }` for two-key pattern
     * @param options.initialBalance - Initial HBAR balance (default: 0)
     * @param options.receiverSignatureRequired - Require receiver sig for inbound transfers
     * @param options.memo - Account memo (max 100 bytes)
     * @param options.maxAutomaticTokenAssociations - Max auto token associations (0 = none, -1 = unlimited)
     * @param options.stakedAccountId - Account ID to stake to (mutually exclusive with stakedNodeId)
     * @param options.stakedNodeId - Node ID to stake to (mutually exclusive with stakedAccountId)
     * @param options.declineStakingReward - Whether to decline staking rewards
     * @param scheduleOptions - Payer, admin key, and schedule memo
     * @returns The schedule entity ID and the transaction ID of the `ScheduleCreateTransaction`
     */
    scheduleCreateAccount(
        options: CreateAccountOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        return this.createOperation.schedule(options, scheduleOptions);
    }

    /**
     * Auto-creates a "Hollow Account" by transferring HBAR to an EVM address.
     * Useful for onboarding MetaMask users who don't have a Hedera ID yet.
     *
     * @param options.evmAddress - The EVM address (e.g., 0x...)
     * @param options.amount - The amount of HBAR to transfer
     */
    autoCreateEvmAccount(options: AutoCreateEvmAccountOptions): Promise<void> {
        return this.autoCreateOperation.execute(options);
    }

    /**
     * Schedule the hollow-account HBAR transfer instead of executing immediately.
     *
     * @param options.evmAddress - The EVM address (e.g., 0x...)
     * @param options.amount - The amount of HBAR to transfer
     * @param scheduleOptions - Payer, admin key, and schedule memo
     * @returns The schedule entity ID and the transaction ID of the `ScheduleCreateTransaction`
     */
    scheduleAutoCreateEvmAccount(
        options: AutoCreateEvmAccountOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        return this.autoCreateOperation.schedule(options, scheduleOptions);
    }

    /**
     * Delete an account, transferring remaining balance to another account.
     *
     * @param options.accountId - Account to delete
     * @param options.accountKey - Private key of the account being deleted
     * @param options.transferAccountId - Account to receive remaining balance (defaults to operator)
     */
    deleteAccount(options: DeleteAccountOptions): Promise<void> {
        return this.deleteOperation.execute(options);
    }

    /**
     * Schedule account deletion instead of executing immediately.
     *
     * The account owner's signature is collected later via `ScheduleSignTransaction`
     * — no `accountKey` is required at scheduling time.
     *
     * @param options.accountId - Account to delete
     * @param options.transferAccountId - Account to receive remaining balance (defaults to operator)
     * @param scheduleOptions - Payer, admin key, and schedule memo
     * @returns The schedule entity ID and the transaction ID of the `ScheduleCreateTransaction`
     */
    scheduleDeleteAccount(
        options: ScheduleDeleteAccountOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        return this.deleteOperation.schedule(options, scheduleOptions);
    }

    /**
     * Update an existing account's properties.
     *
     * Requires the account's key to sign — pass it via `additionalSigners`
     * in the options (or use `externalSigners` for HSM/KMS keys).
     *
     * @param options.accountId - The account to update
     * @param options.key - New key for the account (key rotation). Both old and new key must sign
     * @param options.receiverSignatureRequired - Require receiver sig for inbound transfers
     * @param options.memo - Account memo (max 100 bytes)
     * @param options.maxAutomaticTokenAssociations - Max auto token associations
     * @param options.stakedAccountId - Account ID to stake to (mutually exclusive with stakedNodeId)
     * @param options.stakedNodeId - Node ID to stake to (mutually exclusive with stakedAccountId)
     * @param options.declineStakingReward - Whether to decline staking rewards
     * @param options.autoRenewPeriod - Auto-renew period in seconds (30–90 days)
     */
    updateAccount(options: UpdateAccountOptions) {
        return this.updateOperation.execute(options);
    }

    /**
     * Schedule account update instead of executing immediately.
     *
     * @param options.accountId - The account to update
     * @param options.key - New key for the account (key rotation). Both old and new key must sign
     * @param options.receiverSignatureRequired - Require receiver sig for inbound transfers
     * @param options.memo - Account memo (max 100 bytes)
     * @param options.maxAutomaticTokenAssociations - Max auto token associations
     * @param options.stakedAccountId - Account ID to stake to (mutually exclusive with stakedNodeId)
     * @param options.stakedNodeId - Node ID to stake to (mutually exclusive with stakedAccountId)
     * @param options.declineStakingReward - Whether to decline staking rewards
     * @param options.autoRenewPeriod - Auto-renew period in seconds (30–90 days)
     * @param scheduleOptions - Payer, admin key, and schedule memo
     * @returns The schedule entity ID and the transaction ID of the `ScheduleCreateTransaction`
     */
    scheduleUpdateAccount(
        options: UpdateAccountOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        return this.updateOperation.schedule(options, scheduleOptions);
    }

    /**
     * Get the balance of an account.
     *
     * @param accountId - Account to query
     * @returns The account balance
     */
    getAccountBalance(accountId: string | AccountId): Promise<Balance> {
        return this.balanceQuery.execute(accountId);
    }

    /**
     * Get the balance of the operator account.
     *
     * @returns The operator account balance
     */
    getOperatorAccountBalance(): Promise<Balance> {
        return this.balanceQuery.execute(this.context.operatorAccountId);
    }

    /**
     * Approve HBAR allowances — grant a spender permission to spend
     * HBAR on the owner's behalf.
     *
     * The owner's key must sign the transaction. If the operator is not the owner,
     * pass the owner's key via `additionalSigners`.
     *
     * @param options.hbarAllowances - HBAR spending allowances to approve (at least one)
     */
    approveHbarAllowance(options: ApproveHbarAllowanceOptions): Promise<void> {
        if (!options.hbarAllowances?.length) {
            throw normalizeError(
                new Error(
                    "hbarAllowances must be provided with at least one entry.",
                ),
                "AccountService",
            );
        }
        return this.approveAllowanceOperation.execute(options);
    }

    /**
     * Approve fungible token allowances — grant a spender permission to transfer
     * tokens on the owner's behalf.
     *
     * The owner's key must sign the transaction. If the operator is not the owner,
     * pass the owner's key via `additionalSigners`.
     *
     * @param options.tokenAllowances - Fungible token allowances to approve (at least one)
     */
    approveTokenAllowance(
        options: ApproveTokenAllowanceOptions,
    ): Promise<void> {
        if (!options.tokenAllowances?.length) {
            throw normalizeError(
                new Error(
                    "tokenAllowances must be provided with at least one entry.",
                ),
                "AccountService",
            );
        }
        return this.approveAllowanceOperation.execute(options);
    }

    /**
     * Approve NFT allowances — grant a spender permission to transfer
     * NFTs on the owner's behalf. Supports specific serials or all serials.
     *
     * The owner's key must sign the transaction. If the operator is not the owner,
     * pass the owner's key via `additionalSigners`.
     *
     * @param options.nftAllowances - NFT allowances to approve (at least one)
     */
    approveNftAllowance(options: ApproveNftAllowanceOptions): Promise<void> {
        if (!options.nftAllowances?.length) {
            throw normalizeError(
                new Error(
                    "nftAllowances must be provided with at least one entry.",
                ),
                "AccountService",
            );
        }
        return this.approveAllowanceOperation.execute(options);
    }
}
