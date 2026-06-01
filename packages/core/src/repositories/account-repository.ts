import type { MirrorAccountInfo, Balance } from "../types/index.js";
import type { MirrorNodeClient } from "../mirror/index.js";
import { HieroError, HieroErrorCodes } from "../errors/index.js";

/**
 * Repository for querying account data from the mirror node.
 */
export class AccountRepository {
    constructor(private readonly mirrorNodeClient: MirrorNodeClient) {}

    /**
     * Find account information by account ID.
     */
    async findByAccountId(accountId: string): Promise<MirrorAccountInfo> {
        return this.mirrorNodeClient.queryAccount(accountId);
    }

    /**
     * Find account information by EVM alias (0x-prefixed address).
     *
     * @param alias - An EVM address (e.g. `0x1234...abcd`)
     */
    async findByAlias(alias: string): Promise<MirrorAccountInfo> {
        const isValidEvmAddress =
            alias.startsWith("0x") &&
            alias.length === 42 &&
            /^[0-9a-fA-F]+$/.test(alias.slice(2));

        if (!isValidEvmAddress) {
            throw new HieroError(
                `Invalid EVM alias: expected a 0x-prefixed 20-byte hex address, got "${alias}".`,
                { code: HieroErrorCodes.ConfigInvalid },
            );
        }
        return this.mirrorNodeClient.queryAccount(alias);
    }

    /**
     * Get the balance of an account.
     */
    async getBalance(accountId: string): Promise<Balance> {
        return this.mirrorNodeClient.queryAccountBalance(accountId);
    }
}
