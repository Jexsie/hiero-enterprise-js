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

describe("AccountService delete-allowance operations [Integration]", () => {
    let client: AccountService;
    let tokenService: FungibleTokenService;
    let nftService: NftService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = new AccountService(ctx);
        tokenService = new FungibleTokenService(ctx);
        nftService = new NftService(ctx);
    });

    it("deletes an HBAR allowance by setting amount to 0", async () => {
        const { owner, spender } = await createOwnerSpenderPair(client);

        // First grant the allowance so there's something to revoke
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

        const granted = await queryHbarAllowances(owner.accountId);
        expect(
            granted.find((a) => a.spender === spender.accountId),
        ).toBeDefined();

        // Now revoke it
        const deleteReceipt = await client.deleteHbarAllowance(
            [
                {
                    ownerAccountId: owner.accountId,
                    spenderAccountId: spender.accountId,
                },
            ],
            { additionalSigners: [owner.key] },
        );
        expect(deleteReceipt.status).toBe(Status.Success);
        await waitForMirrorNodeRecord();

        const after = await queryHbarAllowances(owner.accountId);
        const match = after.find((a) => a.spender === spender.accountId);
        // Mirror node either removes the entry or reports amount=0 after revocation
        expect(match === undefined || match.amount === 0).toBe(true);
    });

    it("deletes a fungible token allowance by setting amount to 0", async () => {
        const { owner, spender } = await createOwnerSpenderPair(client);

        const tokenId = await tokenService.createToken({
            name: "Delete Allowance Token",
            symbol: "DAT",
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

        const granted = await queryTokenAllowances(owner.accountId);
        expect(
            granted.find(
                (a) =>
                    a.spender === spender.accountId && a.token_id === tokenId,
            ),
        ).toBeDefined();

        // Revoke it
        const deleteReceipt = await client.deleteTokenAllowance(
            [
                {
                    tokenId,
                    ownerAccountId: owner.accountId,
                    spenderAccountId: spender.accountId,
                },
            ],
            { additionalSigners: [owner.key] },
        );
        expect(deleteReceipt.status).toBe(Status.Success);
        await waitForMirrorNodeRecord();

        const after = await queryTokenAllowances(owner.accountId);
        const match = after.find(
            (a) => a.spender === spender.accountId && a.token_id === tokenId,
        );
        expect(match === undefined || match.amount === 0).toBe(true);
    });

    it("deletes an NFT allowance for specific serials", async () => {
        const { owner, spender } = await createOwnerSpenderPair(client);

        const tokenId = await nftService.createNftType({
            name: "Delete NFT Allowance",
            symbol: "DNAL",
            treasuryAccountId: owner.accountId,
            treasuryKey: owner.key,
            supplyKey: owner.key,
        });

        await nftService.mintNfts(
            tokenId,
            [Buffer.from("meta-1"), Buffer.from("meta-2")],
            owner.key,
        );

        // Grant per-serial allowance
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

        // Verify spender was set on both serials
        for (const serial of [1, 2]) {
            const nft = await queryNftRecord(tokenId, serial);
            expect(nft.spender).toBe(spender.accountId);
        }

        // Revoke per-serial allowance
        const deleteReceipt = await client.deleteNftAllowance(
            [
                {
                    tokenId,
                    ownerAccountId: owner.accountId,
                    serialNumbers: [1, 2],
                },
            ],
            { additionalSigners: [owner.key] },
        );
        expect(deleteReceipt.status).toBe(Status.Success);
        await waitForMirrorNodeRecord();

        // Verify spender was cleared on both serials
        for (const serial of [1, 2]) {
            const nft = await queryNftRecord(tokenId, serial);
            expect(nft.spender == null).toBe(true);
        }
    });
});
