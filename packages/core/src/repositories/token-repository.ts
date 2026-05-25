import type { MirrorTokenInfo, Page } from "../types/index.js";
import type { MirrorNodeClient } from "../mirror/index.js";

/**
 * Repository for querying token data from the mirror node.
 */
export class TokenRepository {
    constructor(private readonly mirrorNodeClient: MirrorNodeClient) {}

    /**
     * Find token information by token ID.
     */
    async findById(tokenId: string): Promise<MirrorTokenInfo> {
        return this.mirrorNodeClient.queryTokenById(tokenId);
    }

    /**
     * Find all tokens associated with an account.
     */
    async findByAccountId(accountId: string): Promise<Page<MirrorTokenInfo>> {
        return this.mirrorNodeClient.queryTokensByAccountId(accountId);
    }
}
