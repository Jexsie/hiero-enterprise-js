import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import { waitForMirrorNodeRecord } from "../../../utils/mirror-node.js";
import { queryAccountTokens } from "../../../utils/mirror-node-rest.js";
import {
    createTestAccount,
    type TestAccount,
} from "../../../utils/integration-fixtures.js";
import {
    AccountService,
    TokenService,
} from "../../../../src/services/index.js";

describe("TokenService airdrop operations [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let owner: TestAccount;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        owner = await createTestAccount(accountService, 10);
    });

    it("airdrops fungible tokens to an associated receiver", async () => {
        const receiver = await createTestAccount(accountService, 2);

        const tokenId = await tokenService.createFungibleToken({
            tokenName: "Airdrop Integration",
            tokenSymbol: "AIR",
            decimals: 0,
            initialSupply: 100,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.associateToken({
            accountId: receiver.accountId,
            tokenId,
            additionalSigners: [receiver.key],
        });

        await tokenService.airdropFungibleToken({
            tokenId,
            senderAccountId: owner.accountId,
            receiverAccountId: receiver.accountId,
            amount: 10,
            additionalSigners: [owner.key],
        });

        await waitForMirrorNodeRecord();

        const tokens = await queryAccountTokens(receiver.accountId);
        const relationship = tokens.find((t) => t.token_id === tokenId);
        expect(relationship).toBeDefined();
        expect(relationship?.balance).toBe("10");
    });
});
