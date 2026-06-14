import type {
    AccountId,
    TokenId,
    Transaction,
    TransactionReceipt,
    Hbar,
} from "@hiero-ledger/sdk";
import type { Account, Balance } from "../../types/index.js";
import type { IHieroContext } from "../../context/index.js";
import { normalizeError } from "../../errors/index.js";
import {
    CreateAccountOperation,
    AutoCreateEvmAccountOperation,
    DeleteAccountOperation,
    UpdateAccountOperation,
    ApproveAllowanceOperation,
    DeleteAllowanceOperation,
    DeleteAllNftAllowancesOperation,
    TransferOperation,
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
    DeleteAllowanceOptions,
    DeleteAllNftAllowancesOptions,
    NftAllowanceDeletion,
    NftAllSerialsAllowanceDeletion,
    HbarAllowanceDeletion,
    TokenAllowanceDeletion,
    TransferHbarOptions,
    TransferTokenOptions,
    TransferNftOptions,
    ScheduleTransferHbarOptions,
    ScheduleTransferTokenOptions,
    ScheduleTransferNftOptions,
} from "./operations/index.js";
import { AccountBalanceQuery, AccountSignatureQuery } from "./queries/index.js";
import type {
    ScheduleOptions,
    ScheduledResult,
    TransactionOptions,
} from "../transaction/index.js";

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
    private readonly deleteAllowanceOperation: DeleteAllowanceOperation;
    private readonly deleteAllNftAllowancesOperation: DeleteAllNftAllowancesOperation;
    private readonly transferOperation: TransferOperation;
    private readonly balanceQuery: AccountBalanceQuery;
    private readonly signatureQuery: AccountSignatureQuery;

    constructor(private readonly context: IHieroContext) {
        this.createOperation = new CreateAccountOperation(context);
        this.autoCreateOperation = new AutoCreateEvmAccountOperation(context);
        this.deleteOperation = new DeleteAccountOperation(context);
        this.updateOperation = new UpdateAccountOperation(context);
        this.approveAllowanceOperation = new ApproveAllowanceOperation(context);
        this.deleteAllowanceOperation = new DeleteAllowanceOperation(context);
        this.deleteAllNftAllowancesOperation =
            new DeleteAllNftAllowancesOperation(context);
        this.transferOperation = new TransferOperation(context);
        this.balanceQuery = new AccountBalanceQuery(context);
        this.signatureQuery = new AccountSignatureQuery(context);
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
    async createAccount(options: CreateAccountOptions): Promise<Account> {
        return await this.createOperation.execute(options);
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
    async scheduleCreateAccount(
        options: CreateAccountOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        return await this.createOperation.schedule(options, scheduleOptions);
    }

    /**
     * Auto-creates a "Hollow Account" by transferring HBAR to an EVM address.
     * Useful for onboarding MetaMask users who don't have a Hedera ID yet.
     *
     * @param options.evmAddress - The EVM address (e.g., 0x...)
     * @param options.amount - The amount of HBAR to transfer
     */
    async autoCreateEvmAccount(
        options: AutoCreateEvmAccountOptions,
    ): Promise<void> {
        return await this.autoCreateOperation.execute(options);
    }

    /**
     * Schedule the hollow-account HBAR transfer instead of executing immediately.
     *
     * @param options.evmAddress - The EVM address (e.g., 0x...)
     * @param options.amount - The amount of HBAR to transfer
     * @param scheduleOptions - Payer, admin key, and schedule memo
     * @returns The schedule entity ID and the transaction ID of the `ScheduleCreateTransaction`
     */
    async scheduleAutoCreateEvmAccount(
        options: AutoCreateEvmAccountOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        return await this.autoCreateOperation.schedule(
            options,
            scheduleOptions,
        );
    }

    /**
     * Delete an account, transferring remaining balance to another account.
     *
     * @param options.accountId - Account to delete
     * @param options.accountKey - Private key of the account being deleted
     * @param options.transferAccountId - Account to receive remaining balance (defaults to operator)
     */
    async deleteAccount(options: DeleteAccountOptions): Promise<void> {
        return await this.deleteOperation.execute(options);
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
    async scheduleDeleteAccount(
        options: ScheduleDeleteAccountOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        return await this.deleteOperation.schedule(options, scheduleOptions);
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
    async updateAccount(options: UpdateAccountOptions): Promise<void> {
        return await this.updateOperation.execute(options);
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
    async scheduleUpdateAccount(
        options: UpdateAccountOptions,
        scheduleOptions?: ScheduleOptions,
    ): Promise<ScheduledResult> {
        return await this.updateOperation.schedule(options, scheduleOptions);
    }

    /**
     * Get the balance of an account.
     *
     * @param accountId - Account to query
     * @returns The account balance
     */
    async getAccountBalance(accountId: string | AccountId): Promise<Balance> {
        return await this.balanceQuery.execute(accountId);
    }

    /**
     * Get the balance of the operator account.
     *
     * @returns The operator account balance
     */
    async getOperatorAccountBalance(): Promise<Balance> {
        return await this.balanceQuery.execute(this.context.operatorAccountId);
    }

    /**
     * Verify that a message signature was produced by the key currently
     * associated with the given account.
     *
     * Fetches the account's key from the network and delegates to the SDK's
     * `PublicKey.verify`. Returns `false` when the account is multi-sig
     * (its key is a `KeyList`) since a single signature can never satisfy a
     * composite key.
     *
     * @param accountId - Account whose key to check the signature against
     * @param message   - The original message bytes that were signed
     * @param signature - The signature bytes to verify
     */
    async verifyAccountSignature(
        accountId: string | AccountId,
        message: Uint8Array,
        signature: Uint8Array,
    ): Promise<boolean> {
        return await this.signatureQuery.verifySignature(
            accountId,
            message,
            signature,
        );
    }

    /**
     * Verify that a transaction was signed by the key currently associated
     * with the given account.
     *
     * Fetches the account's key from the network and delegates to the SDK's
     * `PublicKey.verifyTransaction`. Returns `false` when the account is
     * multi-sig (its key is a `KeyList`).
     *
     * @param accountId   - Account whose key to check the transaction signature against
     * @param transaction - The signed transaction to verify
     */
    async verifyAccountTransaction(
        accountId: string | AccountId,
        transaction: Transaction,
    ): Promise<boolean> {
        return await this.signatureQuery.verifyTransaction(
            accountId,
            transaction,
        );
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
    async approveHbarAllowance(
        options: ApproveHbarAllowanceOptions,
    ): Promise<TransactionReceipt> {
        if (!options.hbarAllowances?.length) {
            throw normalizeError(
                new Error(
                    "hbarAllowances must be provided with at least one entry.",
                ),
                "AccountService.approveHbarAllowance",
            );
        }
        return await this.approveAllowanceOperation.execute(
            options,
            "approveHbarAllowance",
        );
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
    async approveTokenAllowance(
        options: ApproveTokenAllowanceOptions,
    ): Promise<TransactionReceipt> {
        if (!options.tokenAllowances?.length) {
            throw normalizeError(
                new Error(
                    "tokenAllowances must be provided with at least one entry.",
                ),
                "AccountService.approveTokenAllowance",
            );
        }
        return await this.approveAllowanceOperation.execute(
            options,
            "approveTokenAllowance",
        );
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
    async approveNftAllowance(
        options: ApproveNftAllowanceOptions,
    ): Promise<TransactionReceipt> {
        if (!options.nftAllowances?.length) {
            throw normalizeError(
                new Error(
                    "nftAllowances must be provided with at least one entry.",
                ),
                "AccountService.approveNftAllowance",
            );
        }
        return await this.approveAllowanceOperation.execute(
            options,
            "approveNftAllowance",
        );
    }

    /**
     * Delete NFT allowances — revoke a spender's approval for specific NFT
     * serial numbers previously granted by the owner.
     *
     * The owner's key must sign the transaction. If the operator is not the
     * owner, pass the owner's key via `options.additionalSigners`.
     *
     * Note: Only per-serial NFT allowance deletion is supported by the protocol.
     * To remove HBAR or fungible token allowances, call `approveHbarAllowance`
     * / `approveTokenAllowance` with `amount: 0`. To revoke an
     * "approve-for-all-serials" grant, use `deleteAllNftAllowances`.
     *
     * @param allowances - NFT allowance deletions to apply (at least one)
     * @param options - Optional base transaction options (signers, memo, etc.)
     */
    async deleteNftAllowance(
        allowances: NftAllowanceDeletion[],
        options: DeleteAllowanceOptions = {},
    ): Promise<TransactionReceipt> {
        if (!allowances?.length) {
            throw normalizeError(
                new Error(
                    "nftAllowances must be provided with at least one entry.",
                ),
                "AccountService.deleteNftAllowance",
            );
        }
        return await this.deleteAllowanceOperation.execute(
            allowances,
            options,
            "deleteNftAllowance",
        );
    }

    /**
     * Delete "approve-for-all-serials" NFT allowances — revoke a spender's
     * blanket approval to transfer any NFT in the collection on the owner's
     * behalf. Use this to undo a previous `approveNftAllowance`
     *
     * For revoking specific serial numbers, use `deleteNftAllowance` instead.
     *
     * The owner's key must sign the transaction. If the operator is not the
     * owner, pass the owner's key via `options.additionalSigners`.
     *
     * @param allowances - Approve-for-all-serials deletions to apply (at least one)
     * @param options - Optional base transaction options (signers, memo, etc.)
     */
    async deleteAllNftAllowances(
        allowances: NftAllSerialsAllowanceDeletion[],
        options: DeleteAllNftAllowancesOptions = {},
    ): Promise<TransactionReceipt> {
        if (!allowances?.length) {
            throw normalizeError(
                new Error(
                    "nftAllowances must be provided with at least one entry.",
                ),
                "AccountService.deleteAllNftAllowances",
            );
        }
        return await this.deleteAllNftAllowancesOperation.execute(
            allowances,
            options,
            "deleteAllNftAllowances",
        );
    }

    /**
     * Delete HBAR allowances — revoke a spender's previously granted permission
     * to spend HBAR on the owner's behalf.
     *
     * The owner's key must sign the transaction. If the operator is not the
     * owner, pass the owner's key via `options.additionalSigners`.
     *
     * @param allowances - HBAR allowance deletions to apply (at least one)
     * @param options - Optional base transaction options (signers, memo, etc.)
     */
    async deleteHbarAllowance(
        allowances: HbarAllowanceDeletion[],
        options: TransactionOptions = {},
    ): Promise<TransactionReceipt> {
        if (!allowances?.length) {
            throw normalizeError(
                new Error(
                    "hbarAllowances must be provided with at least one entry.",
                ),
                "AccountService.deleteHbarAllowance",
            );
        }
        return await this.approveAllowanceOperation.execute(
            {
                ...options,
                hbarAllowances: allowances.map((a) => ({
                    ownerAccountId: a.ownerAccountId,
                    spenderAccountId: a.spenderAccountId,
                    amount: 0,
                })),
            },
            "deleteHbarAllowance",
        );
    }

    /**
     * Delete fungible token allowances — revoke a spender's previously granted
     * permission to transfer tokens on the owner's behalf.
     *
     * The owner's key must sign the transaction. If the operator is not the
     * owner, pass the owner's key via `options.additionalSigners`.
     *
     * @param allowances - Fungible token allowance deletions to apply (at least one)
     * @param options - Optional base transaction options (signers, memo, etc.)
     */
    async deleteTokenAllowance(
        allowances: TokenAllowanceDeletion[],
        options: TransactionOptions = {},
    ): Promise<TransactionReceipt> {
        if (!allowances?.length) {
            throw normalizeError(
                new Error(
                    "tokenAllowances must be provided with at least one entry.",
                ),
                "AccountService.deleteTokenAllowance",
            );
        }
        return await this.approveAllowanceOperation.execute(
            {
                ...options,
                tokenAllowances: allowances.map((a) => ({
                    tokenId: a.tokenId,
                    ownerAccountId: a.ownerAccountId,
                    spenderAccountId: a.spenderAccountId,
                    amount: 0,
                })),
            },
            "deleteTokenAllowance",
        );
    }

    // Crypto Transfers

    /**
     * Transfer HBAR to another account.
     *
     * @param receiverAccountId - Recipient account (string `"0.0.123"` or `AccountId`)
     * @param amount - Amount in HBAR or an `Hbar` instance for tinybar precision
     * @param senderAccountId - Sender account. Pass the operator account when the
     *   operator is the sender; otherwise pass the sender's account **and** its
     *   private key via `options.additionalSigners` — otherwise the transaction
     *   will be rejected with `INVALID_SIGNATURE`.
     * @param options - Transaction options (fees, validity, signers, memo, etc.)
     */
    async transferHbar(
        receiverAccountId: string | AccountId,
        amount: number | Hbar,
        senderAccountId: string | AccountId,
        options?: TransferHbarOptions,
    ): Promise<void> {
        return await this.transferOperation.transferHbar(
            receiverAccountId,
            amount,
            senderAccountId,
            options,
        );
    }

    /**
     * Schedule an HBAR transfer.
     *
     * @param receiverAccountId - Recipient account
     * @param amount - Amount in HBAR or `Hbar`
     * @param senderAccountId - Sender account. Pass the operator account when the
     *   operator is the sender; otherwise pass the sender's account **and** its
     *   private key via `options.additionalSigners`.
     * @param options - Combined transaction + schedule options
     *   (`payerAccountId`, `adminKey`, `scheduleMemo`, plus base transaction fields)
     */
    async scheduleTransferHbar(
        receiverAccountId: string | AccountId,
        amount: number | Hbar,
        senderAccountId: string | AccountId,
        options?: ScheduleTransferHbarOptions,
    ): Promise<ScheduledResult> {
        return await this.transferOperation.scheduleTransferHbar(
            receiverAccountId,
            amount,
            senderAccountId,
            options,
        );
    }

    /**
     * Transfer fungible tokens to another account.
     *
     * @param tokenId - The token type to transfer (string `"0.0.456"` or `TokenId`)
     * @param receiverAccountId - Recipient account (string or `AccountId`)
     * @param amount - Amount in the token's smallest unit
     * @param senderAccountId - Sender account. Pass the operator account when the
     *   operator is the sender; otherwise pass the sender's account **and** its
     *   private key via `options.additionalSigners`.
     * @param options - Transaction options; `expectedDecimals` enables magnitude safety check
     */
    async transferToken(
        tokenId: string | TokenId,
        receiverAccountId: string | AccountId,
        amount: number,
        senderAccountId: string | AccountId,
        options?: TransferTokenOptions,
    ): Promise<void> {
        return await this.transferOperation.transferToken(
            tokenId,
            receiverAccountId,
            amount,
            senderAccountId,
            options,
        );
    }

    /**
     * Schedule a fungible token transfer.
     *
     * @param senderAccountId - Sender account. Pass the operator account when the
     *   operator is the sender; otherwise pass the sender's account **and** its
     *   private key via `options.additionalSigners`.
     * @param options - Combined transaction + schedule options
     */
    async scheduleTransferToken(
        tokenId: string | TokenId,
        receiverAccountId: string | AccountId,
        amount: number,
        senderAccountId: string | AccountId,
        options?: ScheduleTransferTokenOptions,
    ): Promise<ScheduledResult> {
        return await this.transferOperation.scheduleTransferToken(
            tokenId,
            receiverAccountId,
            amount,
            senderAccountId,
            options,
        );
    }

    /**
     * Transfer an NFT to another account.
     *
     * @param tokenId - The NFT collection token ID (string `"0.0.789"` or `TokenId`)
     * @param serial - Serial number of the NFT
     * @param receiverAccountId - Recipient account (string or `AccountId`)
     * @param senderAccountId - Sender account. Pass the operator account when the
     *   operator is the sender; otherwise pass the sender's account **and** its
     *   private key via `options.additionalSigners`.
     * @param options - Transaction options (fees, validity, signers, memo, etc.)
     */
    async transferNft(
        tokenId: string | TokenId,
        serial: number,
        receiverAccountId: string | AccountId,
        senderAccountId: string | AccountId,
        options?: TransferNftOptions,
    ): Promise<void> {
        return await this.transferOperation.transferNft(
            tokenId,
            serial,
            receiverAccountId,
            senderAccountId,
            options,
        );
    }

    /**
     * Schedule an NFT transfer.
     *
     * @param senderAccountId - Sender account. Pass the operator account when the
     *   operator is the sender; otherwise pass the sender's account **and** its
     *   private key via `options.additionalSigners`.
     * @param options - Combined transaction + schedule options
     */
    async scheduleTransferNft(
        tokenId: string | TokenId,
        serial: number,
        receiverAccountId: string | AccountId,
        senderAccountId: string | AccountId,
        options?: ScheduleTransferNftOptions,
    ): Promise<ScheduledResult> {
        return await this.transferOperation.scheduleTransferNft(
            tokenId,
            serial,
            receiverAccountId,
            senderAccountId,
            options,
        );
    }
}
