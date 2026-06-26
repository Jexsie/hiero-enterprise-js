import { describe, it, expect, beforeAll } from "vitest";
import { NftId, TokenId } from "@hiero-ledger/sdk";
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

function tokenBalanceFor(
    balance: { tokens: { tokenId: string; balance: string }[] },
    tokenId: string,
): string | undefined {
    return balance.tokens.find((t) => t.tokenId === tokenId)?.balance;
}

describe("TokenService reject operations [Integration]", () => {
    let accountService: AccountService;
    let tokenService: TokenService;
    let owner: TestAccount;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        accountService = new AccountService(ctx);
        tokenService = new TokenService(ctx);
        owner = await createTestAccount(accountService, 10);
    });

    it("rejects fungible tokens, returning supply to the treasury and dissociating the holder", async () => {
        const holder = await createTestAccount(accountService, 2);
        const initialSupply = 1_000;
        const transferAmount = 250;

        const tokenId = await tokenService.createFungibleToken({
            tokenName: "Reject Fungible Integration",
            tokenSymbol: "RFI",
            decimals: 0,
            initialSupply,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.associateToken({
            accountId: holder.accountId,
            tokenId,
            additionalSigners: [holder.key],
        });

        await accountService.transferToken(
            tokenId,
            holder.accountId,
            transferAmount,
            owner.accountId,
            { additionalSigners: [owner.key] },
        );

        await waitForMirrorNodeRecord();

        // Sanity: holder owns the transferred amount, treasury debited.
        const holderBefore = await accountService.getAccountBalance(
            holder.accountId,
        );
        expect(tokenBalanceFor(holderBefore, tokenId)).toBe(
            String(transferAmount),
        );

        await tokenService.rejectTokensFlow({
            ownerId: holder.accountId,
            fungibleTokenIds: [tokenId],
            ownerKey: holder.key,
        });

        await waitForMirrorNodeRecord();

        // Post-reject: holder is dissociated from the token (no relationship)
        // and the treasury supply has been restored in full.
        const holderTokens = await queryAccountTokens(holder.accountId);
        expect(
            holderTokens.find((t) => t.token_id === tokenId),
        ).toBeUndefined();

        const treasuryBalance = await accountService.getAccountBalance(
            owner.accountId,
        );
        expect(tokenBalanceFor(treasuryBalance, tokenId)).toBe(
            String(initialSupply),
        );
    });

    it("rejects NFT serials, returning them to the treasury and dissociating the holder", async () => {
        const holder = await createTestAccount(accountService, 2);

        // HIP-904 requires every TokenReference in a single TokenReject
        // to have a unique token ID, so we mint TWO collections and
        // transfer one serial of each to the holder. Rejecting both in
        // one flow also exercises the dissociate step for two tokens.
        const tokenIdA = await tokenService.createNft({
            tokenName: "Reject NFT A",
            tokenSymbol: "RNA",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        const tokenIdB = await tokenService.createNft({
            tokenName: "Reject NFT B",
            tokenSymbol: "RNB",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.mintToken({
            tokenId: tokenIdA,
            metadata: [Buffer.from("a-1")],
            additionalSigners: [owner.key],
        });
        await tokenService.mintToken({
            tokenId: tokenIdB,
            metadata: [Buffer.from("b-1")],
            additionalSigners: [owner.key],
        });

        for (const tokenId of [tokenIdA, tokenIdB]) {
            await tokenService.associateToken({
                accountId: holder.accountId,
                tokenId,
                additionalSigners: [holder.key],
            });
        }

        await accountService.transferNft(
            tokenIdA,
            1,
            holder.accountId,
            owner.accountId,
            { additionalSigners: [owner.key] },
        );
        await accountService.transferNft(
            tokenIdB,
            1,
            holder.accountId,
            owner.accountId,
            { additionalSigners: [owner.key] },
        );

        await waitForMirrorNodeRecord();

        const holderBefore = await accountService.getAccountBalance(
            holder.accountId,
        );
        expect(tokenBalanceFor(holderBefore, tokenIdA)).toBe("1");
        expect(tokenBalanceFor(holderBefore, tokenIdB)).toBe("1");

        await tokenService.rejectTokensFlow({
            ownerId: holder.accountId,
            nftIds: [
                new NftId(TokenId.fromString(tokenIdA), 1),
                new NftId(TokenId.fromString(tokenIdB), 1),
            ],
            ownerKey: holder.key,
        });

        await waitForMirrorNodeRecord();

        // Holder is dissociated from both collections; each treasury
        // holds its only serial again.
        const holderTokens = await queryAccountTokens(holder.accountId);
        expect(
            holderTokens.find((t) => t.token_id === tokenIdA),
        ).toBeUndefined();
        expect(
            holderTokens.find((t) => t.token_id === tokenIdB),
        ).toBeUndefined();

        const treasuryBalance = await accountService.getAccountBalance(
            owner.accountId,
        );
        expect(tokenBalanceFor(treasuryBalance, tokenIdA)).toBe("1");
        expect(tokenBalanceFor(treasuryBalance, tokenIdB)).toBe("1");
    });

    it("rejects fungible tokens and NFT serials in a single call", async () => {
        const holder = await createTestAccount(accountService, 2);
        const fungibleSupply = 500;
        const fungibleTransfer = 100;

        const fungibleTokenId = await tokenService.createFungibleToken({
            tokenName: "Reject Mixed Fungible",
            tokenSymbol: "RMF",
            decimals: 0,
            initialSupply: fungibleSupply,
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        const nftTokenId = await tokenService.createNft({
            tokenName: "Reject Mixed NFT",
            tokenSymbol: "RMN",
            treasuryAccountId: owner.accountId,
            supplyKey: owner.key.publicKey,
            additionalSigners: [owner.key],
        });

        await tokenService.mintToken({
            tokenId: nftTokenId,
            metadata: [Buffer.from("mix-1"), Buffer.from("mix-2")],
            additionalSigners: [owner.key],
        });

        for (const tokenId of [fungibleTokenId, nftTokenId]) {
            await tokenService.associateToken({
                accountId: holder.accountId,
                tokenId,
                additionalSigners: [holder.key],
            });
        }

        await accountService.transferToken(
            fungibleTokenId,
            holder.accountId,
            fungibleTransfer,
            owner.accountId,
            { additionalSigners: [owner.key] },
        );
        await accountService.transferNft(
            nftTokenId,
            1,
            holder.accountId,
            owner.accountId,
            { additionalSigners: [owner.key] },
        );

        await waitForMirrorNodeRecord();

        await tokenService.rejectTokensFlow({
            ownerId: holder.accountId,
            fungibleTokenIds: [fungibleTokenId],
            nftIds: [new NftId(TokenId.fromString(nftTokenId), 1)],
            ownerKey: holder.key,
        });

        await waitForMirrorNodeRecord();

        // Both relationships are gone after the dissociation step of the flow.
        const holderTokens = await queryAccountTokens(holder.accountId);
        expect(
            holderTokens.find((t) => t.token_id === fungibleTokenId),
        ).toBeUndefined();
        expect(
            holderTokens.find((t) => t.token_id === nftTokenId),
        ).toBeUndefined();

        // Treasury supply has been restored for both.
        const treasuryBalance = await accountService.getAccountBalance(
            owner.accountId,
        );
        expect(tokenBalanceFor(treasuryBalance, fungibleTokenId)).toBe(
            String(fungibleSupply),
        );
        expect(tokenBalanceFor(treasuryBalance, nftTokenId)).toBe("2");
    });

    it("throws when neither fungibleTokenIds nor nftIds is supplied", async () => {
        await expect(
            tokenService.rejectTokensFlow({
                ownerId: owner.accountId,
                ownerKey: owner.key,
            }),
        ).rejects.toThrow(/at least one fungibleTokenId or nftId/i);
    });
});
