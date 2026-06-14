import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../utils/env.js";
import { waitForMirrorNodeRecord } from "../utils/mirror-node.js";
import {
    AccountService,
    FungibleTokenService,
    NftService,
} from "../../src/services/index.js";
import { AccountType } from "../../src/types/index.js";
import { PrivateKey, Status } from "@hiero-ledger/sdk";

const MIRROR_URL = process.env.HIERO_MIRROR_NODE_URL;

interface MirrorAllowance {
    owner: string;
    spender: string;
    amount?: number;
    token_id?: string;
}

async function queryHbarAllowances(
    ownerAccountId: string,
): Promise<MirrorAllowance[]> {
    const url = `${MIRROR_URL}/api/v1/accounts/${ownerAccountId}/allowances/crypto`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(
            `Mirror Node GET ${url} failed with status ${res.status}: ${await res.text()}`,
        );
    }
    const data = (await res.json()) as { allowances?: MirrorAllowance[] };
    return data.allowances ?? [];
}

async function queryTokenAllowances(
    ownerAccountId: string,
): Promise<MirrorAllowance[]> {
    const url = `${MIRROR_URL}/api/v1/accounts/${ownerAccountId}/allowances/tokens`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(
            `Mirror Node GET ${url} failed with status ${res.status}: ${await res.text()}`,
        );
    }
    const data = (await res.json()) as { allowances?: MirrorAllowance[] };
    return data.allowances ?? [];
}

describe("AccountService [Integration]", () => {
    let client: AccountService;
    let tokenService: FungibleTokenService;
    let nftService: NftService;

    beforeAll(() => {
        // Setup internal context to point directly at localhost nodes
        const ctx = setupIntegrationTestEnv();
        client = new AccountService(ctx);
        tokenService = new FungibleTokenService(ctx);
        nftService = new NftService(ctx);
    });

    it("creates an ED25519 account with a user-provided public key", async () => {
        const newKey = PrivateKey.generateED25519();
        const account = await client.createAccount({
            publicKey: newKey.publicKey.toString(),
            keyType: AccountType.ED25519,
            initialBalance: 15,
            memo: "E2E Test Native",
        });

        expect(account.accountId).toBeDefined();
        expect(account.publicKey).toBeDefined();
        expect(account.evmAddress).toBeUndefined();

        // Wait for consensus propagation to Mirror Node locally
        await waitForMirrorNodeRecord();

        const balance = await client.getAccountBalance(account.accountId);
        expect(balance.hbars).toBe(String(15 * 100_000_000));

        // Delete using the key we generated
        await client.deleteAccount({
            accountId: account.accountId,
            accountKey: newKey,
        });

        await waitForMirrorNodeRecord();

        await expect(
            client.getAccountBalance(account.accountId),
        ).rejects.toThrow(/ACCOUNT_DELETED/);
    }, 25000);

    it("creates an ECDSA account with derived EVM alias", async () => {
        const ecdsaKey = PrivateKey.generateECDSA();

        const account = await client.createAccount({
            publicKey: ecdsaKey.publicKey.toString(),
            keyType: AccountType.ECDSA,
            alias: true,
            initialBalance: 5,
            memo: "EVM Alias Test",
        });

        expect(account.accountId).toBeDefined();
        expect(account.evmAddress).toBeDefined();

        const balance = await client.getAccountBalance(account.accountId);
        expect(balance.hbars).toBe(String(5 * 100_000_000));
    }, 25000);

    it("autoCreateEvmAccount successfully transfers HBAR to a cold '0x' address", async () => {
        // A random dummy strictly formatted 20-byte EVM hex
        const coldAddress = "0x1111111111111111111111111111111111111111";

        await expect(
            client.autoCreateEvmAccount({ evmAddress: coldAddress, amount: 5 }),
        ).resolves.not.toThrow();
    }, 20000);

    it("approves an HBAR allowance for a spender account", async () => {
        const ownerKey = PrivateKey.generateED25519();
        const owner = await client.createAccount({
            publicKey: ownerKey.publicKey.toString(),
            keyType: AccountType.ED25519,
            initialBalance: 10,
        });

        const spenderKey = PrivateKey.generateED25519();
        const spender = await client.createAccount({
            publicKey: spenderKey.publicKey.toString(),
            keyType: AccountType.ED25519,
            initialBalance: 1,
        });

        const approveReceipt = await client.approveHbarAllowance({
            hbarAllowances: [
                {
                    ownerAccountId: owner.accountId,
                    spenderAccountId: spender.accountId,
                    amount: 5,
                },
            ],
            additionalSigners: [ownerKey],
        });
        expect(approveReceipt.status).toBe(Status.Success);

        await waitForMirrorNodeRecord();

        const allowances = await queryHbarAllowances(owner.accountId);
        const match = allowances.find((a) => a.spender === spender.accountId);
        expect(match).toBeDefined();
        expect(match!.amount).toBe(500_000_000); // 5 HBAR in tinybars
    }, 30000);

    it("approves a fungible token allowance for a spender account", async () => {
        const ownerKey = PrivateKey.generateED25519();
        const owner = await client.createAccount({
            publicKey: ownerKey.publicKey.toString(),
            keyType: AccountType.ED25519,
            initialBalance: 10,
        });

        const spenderKey = PrivateKey.generateED25519();
        const spender = await client.createAccount({
            publicKey: spenderKey.publicKey.toString(),
            keyType: AccountType.ED25519,
            initialBalance: 1,
        });

        const tokenId = await tokenService.createToken({
            name: "Allowance Test Token",
            symbol: "ATT",
            decimals: 2,
            initialSupply: 10000,
            treasuryAccountId: owner.accountId,
            treasuryKey: ownerKey,
            supplyKey: ownerKey,
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
            additionalSigners: [ownerKey],
        });
        expect(approveReceipt.status).toBe(Status.Success);

        await waitForMirrorNodeRecord();

        const allowances = await queryTokenAllowances(owner.accountId);
        const match = allowances.find(
            (a) => a.spender === spender.accountId && a.token_id === tokenId,
        );
        expect(match).toBeDefined();
        expect(match!.amount).toBe(500);
    }, 30000);

    it("approves an NFT allowance for specific serials", async () => {
        const ownerKey = PrivateKey.generateED25519();
        const owner = await client.createAccount({
            publicKey: ownerKey.publicKey.toString(),
            keyType: AccountType.ED25519,
            initialBalance: 10,
        });

        const spenderKey = PrivateKey.generateED25519();
        const spender = await client.createAccount({
            publicKey: spenderKey.publicKey.toString(),
            keyType: AccountType.ED25519,
            initialBalance: 1,
        });

        const tokenId = await nftService.createNftType({
            name: "Allowance NFT",
            symbol: "ANFT",
            treasuryAccountId: owner.accountId,
            treasuryKey: ownerKey,
            supplyKey: ownerKey,
        });

        await nftService.mintNfts(
            tokenId,
            [Buffer.from("meta-1"), Buffer.from("meta-2")],
            ownerKey,
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
            additionalSigners: [ownerKey],
        });
        expect(approveReceipt.status).toBe(Status.Success);

        await waitForMirrorNodeRecord();

        // Per-serial allowances are visible on individual NFT records, not the account allowances endpoint
        for (const serial of [1, 2]) {
            const res = await fetch(
                `${MIRROR_URL}/api/v1/tokens/${tokenId}/nfts/${serial}`,
            );
            const nft = (await res.json()) as {
                spender?: string;
                token_id?: string;
                serial_number?: number;
            };
            expect(nft.spender).toBe(spender.accountId);
        }
    }, 30000);

    it("deletes an HBAR allowance by setting amount to 0", async () => {
        const ownerKey = PrivateKey.generateED25519();
        const owner = await client.createAccount({
            publicKey: ownerKey.publicKey.toString(),
            keyType: AccountType.ED25519,
            initialBalance: 10,
        });

        const spenderKey = PrivateKey.generateED25519();
        const spender = await client.createAccount({
            publicKey: spenderKey.publicKey.toString(),
            keyType: AccountType.ED25519,
            initialBalance: 1,
        });

        // First grant the allowance so there's something to revoke
        const approveReceipt = await client.approveHbarAllowance({
            hbarAllowances: [
                {
                    ownerAccountId: owner.accountId,
                    spenderAccountId: spender.accountId,
                    amount: 5,
                },
            ],
            additionalSigners: [ownerKey],
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
            { additionalSigners: [ownerKey] },
        );
        expect(deleteReceipt.status).toBe(Status.Success);
        await waitForMirrorNodeRecord();

        const after = await queryHbarAllowances(owner.accountId);
        const match = after.find((a) => a.spender === spender.accountId);
        // Mirror node either removes the entry or reports amount=0 after revocation
        expect(match === undefined || match.amount === 0).toBe(true);
    }, 45000);

    it("deletes a fungible token allowance by setting amount to 0", async () => {
        const ownerKey = PrivateKey.generateED25519();
        const owner = await client.createAccount({
            publicKey: ownerKey.publicKey.toString(),
            keyType: AccountType.ED25519,
            initialBalance: 10,
        });

        const spenderKey = PrivateKey.generateED25519();
        const spender = await client.createAccount({
            publicKey: spenderKey.publicKey.toString(),
            keyType: AccountType.ED25519,
            initialBalance: 1,
        });

        const tokenId = await tokenService.createToken({
            name: "Delete Allowance Token",
            symbol: "DAT",
            decimals: 2,
            initialSupply: 10000,
            treasuryAccountId: owner.accountId,
            treasuryKey: ownerKey,
            supplyKey: ownerKey,
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
            additionalSigners: [ownerKey],
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
            { additionalSigners: [ownerKey] },
        );
        expect(deleteReceipt.status).toBe(Status.Success);
        await waitForMirrorNodeRecord();

        const after = await queryTokenAllowances(owner.accountId);
        const match = after.find(
            (a) => a.spender === spender.accountId && a.token_id === tokenId,
        );
        expect(match === undefined || match.amount === 0).toBe(true);
    }, 45000);

    it("deletes an NFT allowance for specific serials", async () => {
        const ownerKey = PrivateKey.generateED25519();
        const owner = await client.createAccount({
            publicKey: ownerKey.publicKey.toString(),
            keyType: AccountType.ED25519,
            initialBalance: 10,
        });

        const spenderKey = PrivateKey.generateED25519();
        const spender = await client.createAccount({
            publicKey: spenderKey.publicKey.toString(),
            keyType: AccountType.ED25519,
            initialBalance: 1,
        });

        const tokenId = await nftService.createNftType({
            name: "Delete NFT Allowance",
            symbol: "DNAL",
            treasuryAccountId: owner.accountId,
            treasuryKey: ownerKey,
            supplyKey: ownerKey,
        });

        await nftService.mintNfts(
            tokenId,
            [Buffer.from("meta-1"), Buffer.from("meta-2")],
            ownerKey,
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
            additionalSigners: [ownerKey],
        });
        expect(approveReceipt.status).toBe(Status.Success);
        await waitForMirrorNodeRecord();

        // Verify spender was set on both serials
        for (const serial of [1, 2]) {
            const url = `${MIRROR_URL}/api/v1/tokens/${tokenId}/nfts/${serial}`;
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(
                    `Mirror Node GET ${url} failed with status ${res.status}: ${await res.text()}`,
                );
            }
            const nft = (await res.json()) as { spender?: string | null };
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
            { additionalSigners: [ownerKey] },
        );
        expect(deleteReceipt.status).toBe(Status.Success);
        await waitForMirrorNodeRecord();

        // Verify spender was cleared on both serials
        for (const serial of [1, 2]) {
            const url = `${MIRROR_URL}/api/v1/tokens/${tokenId}/nfts/${serial}`;
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(
                    `Mirror Node GET ${url} failed with status ${res.status}: ${await res.text()}`,
                );
            }
            const nft = (await res.json()) as { spender?: string | null };
            expect(res.ok).toBe(true);
            expect(nft.spender == null).toBe(true);
        }
    }, 60000);

    it("deletes an approve-for-all-serials NFT allowance", async () => {
        const ownerKey = PrivateKey.generateED25519();
        const owner = await client.createAccount({
            publicKey: ownerKey.publicKey.toString(),
            keyType: AccountType.ED25519,
            initialBalance: 10,
        });

        const spenderKey = PrivateKey.generateED25519();
        const spender = await client.createAccount({
            publicKey: spenderKey.publicKey.toString(),
            keyType: AccountType.ED25519,
            initialBalance: 1,
        });

        const tokenId = await nftService.createNftType({
            name: "Delete All NFT Allowance",
            symbol: "DANAL",
            treasuryAccountId: owner.accountId,
            treasuryKey: ownerKey,
            supplyKey: ownerKey,
        });

        await nftService.mintNfts(tokenId, [Buffer.from("meta-1")], ownerKey);

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
            additionalSigners: [ownerKey],
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
            { additionalSigners: [ownerKey] },
        );
        expect(deleteReceipt.status).toBe(Status.Success);
    }, 45000);
});
