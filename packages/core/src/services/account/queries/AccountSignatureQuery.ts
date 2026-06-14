import type { AccountId, PublicKey, Transaction } from "@hiero-ledger/sdk";
import {
    AccountInfoQuery as SdkAccountInfoQuery,
    KeyList,
} from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { normalizeError } from "../../../errors/index.js";

/**
 * Verify signatures against the public key currently associated with an
 * account on the network.
 *
 * Fetches the account's key via `AccountInfoQuery` and delegates to the
 * SDK's `PublicKey.verify` / `PublicKey.verifyTransaction`. Multi-sig
 * accounts (whose key is a `KeyList`) cannot be satisfied by a single
 * signature, so both verify methods return `false` for them.
 */
export class AccountSignatureQuery {
    constructor(private readonly context: IHieroContext) {}

    /**
     * Verify that `signature` over `message` was produced by the key of
     * the given account.
     *
     * Returns `false` when the account is multi-sig (key is a `KeyList`).
     */
    async verifySignature(
        accountId: string | AccountId,
        message: Uint8Array,
        signature: Uint8Array,
    ): Promise<boolean> {
        try {
            const key = await this.fetchSinglePublicKey(accountId);
            if (key === null) return false;
            return key.verify(message, signature);
        } catch (error) {
            throw normalizeError(
                error,
                "AccountService.verifyAccountSignature",
            );
        }
    }

    /**
     * Verify that `transaction` was signed by the key of the given account.
     *
     * Returns `false` when the account is multi-sig (key is a `KeyList`).
     */
    async verifyTransaction(
        accountId: string | AccountId,
        transaction: Transaction,
    ): Promise<boolean> {
        try {
            const key = await this.fetchSinglePublicKey(accountId);
            if (key === null) return false;
            return key.verifyTransaction(transaction);
        } catch (error) {
            throw normalizeError(
                error,
                "AccountService.verifyAccountTransaction",
            );
        }
    }

    /**
     * Fetch the account's key. Returns the `PublicKey` for single-sig
     * accounts, or `null` when the account is multi-sig (`KeyList`).
     */
    private async fetchSinglePublicKey(
        accountId: string | AccountId,
    ): Promise<PublicKey | null> {
        const info = await new SdkAccountInfoQuery()
            .setAccountId(accountId)
            .execute(this.context.client);

        if (info.key instanceof KeyList) {
            return null;
        }
        return info.key as PublicKey;
    }
}
