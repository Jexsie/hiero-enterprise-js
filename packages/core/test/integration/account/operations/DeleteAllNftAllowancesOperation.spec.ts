import { describe, it, expect, beforeAll } from "vitest";
import { Status } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import { createOwnerSpenderPair } from "../../../utils/integration-fixtures.js";
import { AccountService, NftService } from "../../../../src/services/index.js";

describe("AccountService.deleteAllNftAllowances [Integration]", () => {
    let client: AccountService;
    let nftService: NftService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = new AccountService(ctx);
        nftService = new NftService(ctx);
    });

    it("deletes an approve-for-all-serials NFT allowance", async () => {
        const { owner, spender } = await createOwnerSpenderPair(client);

        const tokenId = await nftService.createNftType({
            name: "Delete All NFT Allowance",
            symbol: "DANAL",
            treasuryAccountId: owner.accountId,
            treasuryKey: owner.key,
            supplyKey: owner.key,
        });

        await nftService.mintNfts(tokenId, [Buffer.from("meta-1")], owner.key);

        // Grant approve-for-all-serials. We verify success via the returned
        // receipt's status field rather than via a mirror-node lookup because
        // the Solo (local) Mirror Node does not populate the
        // `/api/v1/accounts/{id}/allowances/nfts` derived view.
        const approveReceipt = await client.approveNftAllowance({
            nftAllowances: [
                {
                    tokenId,
                    ownerAccountId: owner.accountId,
                    spenderAccountId: spender.accountId,
                    allSerials: true,
                },
            ],
            additionalSigners: [owner.key],
        });
        expect(approveReceipt.status).toBe(Status.Success);

        // Revoke approve-for-all-serials. Same verification strategy — the
        // receipt status is the source of truth for this assertion.
        const deleteReceipt = await client.deleteAllNftAllowances(
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
    });
});
