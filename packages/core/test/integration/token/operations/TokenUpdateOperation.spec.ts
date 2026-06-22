import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import { waitForMirrorNodeRecord } from "../../../utils/mirror-node.js";
import { queryTokenInfo } from "../../../utils/mirror-node-rest.js";
import {
    createTestAccount,
    type TestAccount,
} from "../../../utils/integration-fixtures.js";
import {
    AccountService,
    TokenService,
} from "../../../../src/services/index.js";

const supportsScheduledUpdate =
    process.env.HIERO_SUPPORTS_SCHEDULED_TOKEN_UPDATE === "true";

describe("TokenService update operations [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let owner: TestAccount;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        owner = await createTestAccount(accountService, 10);
    });

    it("updates token name, symbol, and memo", async () => {
        const adminKey = PrivateKey.generateED25519();

        const tokenId = await tokenService.createFungibleToken({
            tokenName: "Update Integration",
            tokenSymbol: "UPD",
            decimals: 2,
            initialSupply: 1_000,
            treasuryAccountId: owner.accountId,
            adminKey: adminKey.publicKey,
            supplyKey: owner.key.publicKey,
            tokenMemo: "initial memo",
            additionalSigners: [owner.key, adminKey],
        });

        await tokenService.updateToken({
            tokenId,
            tokenName: "Renamed Token",
            tokenSymbol: "RNM",
            tokenMemo: "updated memo",
            additionalSigners: [adminKey],
        });

        await waitForMirrorNodeRecord();

        const info = await queryTokenInfo(tokenId);
        expect(info.name).toBe("Renamed Token");
        expect(info.symbol).toBe("RNM");
        expect(info.memo).toBe("updated memo");
    });

    it("updates the treasury account", async () => {
        const adminKey = PrivateKey.generateED25519();
        const newTreasury = await createTestAccount(accountService, 5);

        const tokenId = await tokenService.createFungibleToken({
            tokenName: "Treasury Update",
            tokenSymbol: "TUP",
            decimals: 0,
            initialSupply: 500,
            treasuryAccountId: owner.accountId,
            adminKey: adminKey.publicKey,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key, adminKey],
        });

        // The new treasury must be associated to the token before becoming
        // treasury, and the new-treasury key, old-treasury key, and admin
        // key must all sign the update.
        await tokenService.associateToken({
            accountId: newTreasury.accountId,
            tokenId,
            additionalSigners: [newTreasury.key],
        });

        await tokenService.updateToken({
            tokenId,
            treasuryAccountId: newTreasury.accountId,
            additionalSigners: [owner.key, newTreasury.key, adminKey],
        });

        await waitForMirrorNodeRecord();

        const info = await queryTokenInfo(tokenId);
        expect(info.treasury_account_id).toBe(newTreasury.accountId);
    });

    it("schedules a token update", async () => {
        const adminKey = PrivateKey.generateED25519();

        const tokenId = await tokenService.createFungibleToken({
            tokenName: "Schedule Update",
            tokenSymbol: "SUP",
            decimals: 0,
            initialSupply: 100,
            treasuryAccountId: owner.accountId,
            adminKey: adminKey.publicKey,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key, adminKey],
        });

        if (supportsScheduledUpdate) {
            const scheduled = await tokenService.scheduleUpdateToken(
                {
                    tokenId,
                    tokenName: "Scheduled Rename",
                    tokenSymbol: "SRN",
                    additionalSigners: [adminKey],
                },
                { scheduleMemo: "integration scheduled update" },
            );

            expect(scheduled.scheduleId).toMatch(/^0\.0\.\d+$/);
            expect(scheduled.transactionId).toBeDefined();
            return;
        }

        await expect(
            tokenService.scheduleUpdateToken(
                {
                    tokenId,
                    tokenName: "Scheduled Rename",
                    tokenSymbol: "SRN",
                    additionalSigners: [adminKey],
                },
                { scheduleMemo: "integration scheduled update" },
            ),
        ).rejects.toThrow(/SCHEDULED_TRANSACTION_NOT_IN_WHITELIST/);
    });
});
