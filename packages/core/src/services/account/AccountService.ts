import type { PrivateKey, AccountId, Hbar } from "@hiero-ledger/sdk";
import type { Account, Balance } from "../../types/index.js";
import type { IHieroContext } from "../../context/index.js";
import {
    CreateAccountOperation,
    AutoCreateEvmAccountOperation,
    DeleteAccountOperation,
} from "./operations/index.js";
import type { CreateAccountOptions } from "./operations/index.js";
import { AccountBalanceQuery } from "./queries/index.js";

export class AccountService {
    private readonly createOperation: CreateAccountOperation;
    private readonly autoCreateOperation: AutoCreateEvmAccountOperation;
    private readonly deleteOperation: DeleteAccountOperation;
    private readonly balanceQuery: AccountBalanceQuery;

    constructor(private readonly context: IHieroContext) {
        this.createOperation = new CreateAccountOperation(context);
        this.autoCreateOperation = new AutoCreateEvmAccountOperation(context);
        this.deleteOperation = new DeleteAccountOperation(context);
        this.balanceQuery = new AccountBalanceQuery(context);
    }

    /**
     * Create a new account on the network using a caller-provided public key.
     *
     * Key generation is the caller's responsibility (HSM, KMS, wallet, etc.).
     * This method accepts only the public key and submits the
     * `AccountCreateTransaction` to the network.
     *
     * @param options.publicKey - The public key (raw hex or DER-encoded hex)
     * @param options.keyType - Key algorithm: `AccountType.ED25519` (default) or `AccountType.ECDSA`
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
     * Auto-creates a "Hollow Account" by transferring HBAR to an EVM address.
     * Useful for onboarding MetaMask users who don't have a Hedera ID yet.
     *
     * @param evmAddress - The EVM address (e.g., 0x...)
     * @param amount - The amount of HBAR to transfer
     */
    autoCreateEvmAccount(
        evmAddress: string,
        amount: number | Hbar,
    ): Promise<void> {
        return this.autoCreateOperation.execute(evmAddress, amount);
    }

    /**
     * Delete an account, transferring remaining balance to another account.
     *
     * @param accountId - Account to delete
     * @param accountKey - Private key of the account being deleted
     * @param transferAccountId - Account to receive remaining balance (defaults to operator)
     */
    deleteAccount(
        accountId: string | AccountId,
        accountKey: PrivateKey,
        transferAccountId?: string | AccountId,
    ): Promise<void> {
        return this.deleteOperation.execute(
            accountId,
            accountKey,
            transferAccountId,
        );
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
}
