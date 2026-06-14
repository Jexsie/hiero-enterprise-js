import { describe, it, expect, beforeAll } from "vitest";
import { Status } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import { waitForMirrorNodeRecord } from "../../../utils/mirror-node.js";
import {
    queryHbarAllowances,
    queryTokenAllowances,
    queryNftRecord,
} from "../../../utils/mirror-node-rest.js";
import { createOwnerSpenderPair } from "../../../utils/integration-fixtures.js";
import {
    AccountService,
    FungibleTokenService,
    NftService,
} from "../../../../src/services/index.js";

describe("AccountService approve-allowance operations [Integration]", () => {
    let client: AccountService;
    let tokenService: FungibleTokenService;
    let nftService: NftService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = new AccountService(ctx);
        tokenService = new FungibleTokenService(ctx);
        nftService = new NftService(ctx);
    });

    it("approves an HBAR allowance for a spender account", async () => {
        const { owner, spender } = await createOwnerSpenderPair(client);

        const approveReceipt = await client.approveHbarAllowance({
            hbarAllowances: [
                {
                    ownerAccountId: owner.accountId,
                    spenderAccountId: spender.accountId,
                    amount: 5,
                },
            ],
            additionalSigners: [owner.key],
        });
        expect(approveReceipt.status).toBe(Status.Success);

        await waitForMirrorNodeRecord();

        const allowances = await queryHbarAllowances(owner.accountId);
        const match = allowances.find((a) => a.spender === spender.accountId);
        expect(match).toBeDefined();
        expect(match!.amount).toBe(500_000_000); // 5 HBAR in tinybars
    });

    it("approves a fungible token allowance for a spender account", async () => {
        const { owner, spender } = await createOwnerSpenderPair(client);

        const tokenId = await tokenService.createToken({
            name: "Allowance Test Token",
            symbol: "ATT",
            decimals: 2,
            initialSupply: 10000,
            treasuryAccountId: owner.accountId,
            treasuryKey: owner.key,
            supplyKey: owner.key,
        });

        const approveReceipt = await client.approveTokenAllowance({
            tokenAllowances: [
                {
                    tokenId,
                    ownerAccountId: owner.accountId,
                    spenderAccountId: spender.accountId,
                    amount: 500,
                },
            ],
            additionalSigners: [owner.key],
        });
        expect(approveReceipt.status).toBe(Status.Success);

        await waitForMirrorNodeRecord();

        const allowances = await queryTokenAllowances(owner.accountId);
        const match = allowances.find(
            (a) => a.spender === spender.accountId && a.token_id === tokenId,
        );
        expect(match).toBeDefined();
        expect(match!.amount).toBe(500);
    });

    it("approves an NFT allowance for specific serials", async () => {
        const { owner, spender } = await createOwnerSpenderPair(client);

        const tokenId = await nftService.createNftType({
            name: "Allowance NFT",
            symbol: "ANFT",
            treasuryAccountId: owner.accountId,
            treasuryKey: owner.key,
            supplyKey: owner.key,
        });

        await nftService.mintNfts(
            tokenId,
            [Buffer.from("meta-1"), Buffer.from("meta-2")],
            owner.key,
        );

        const approveReceipt = await client.approveNftAllowance({
            nftAllowances: [
                {
                    tokenId,
                    ownerAccountId: owner.accountId,
                    spenderAccountId: spender.accountId,
                    serialNumbers: [1, 2],
                },
            ],
            additionalSigners: [owner.key],
        });
        expect(approveReceipt.status).toBe(Status.Success);

        await waitForMirrorNodeRecord();

        // Per-serial allowances are visible on individual NFT records, not the account allowances endpoint
        for (const serial of [1, 2]) {
            const nft = await queryNftRecord(tokenId, serial);
            expect(nft.spender).toBe(spender.accountId);
        }
    });
});
