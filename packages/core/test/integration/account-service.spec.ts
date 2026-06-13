import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../utils/env.js";
import { waitForMirrorNodeRecord } from "../utils/mirror-node.js";
import {
    AccountService,
    FungibleTokenService,
    NftService,
} from "../../src/services/index.js";
import { AccountType } from "../../src/types/index.js";
import { PrivateKey } from "@hiero-ledger/sdk";

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
    const res = await fetch(
        `${MIRROR_URL}/api/v1/accounts/${ownerAccountId}/allowances/crypto`,
    );
    const data = (await res.json()) as { allowances?: MirrorAllowance[] };
    return data.allowances ?? [];
}

async function queryTokenAllowances(
    ownerAccountId: string,
): Promise<MirrorAllowance[]> {
    const res = await fetch(
        `${MIRROR_URL}/api/v1/accounts/${ownerAccountId}/allowances/tokens`,
    );
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

        await client.approveHbarAllowance({
            hbarAllowances: [
                {
                    ownerAccountId: owner.accountId,
                    spenderAccountId: spender.accountId,
                    amount: 5,
                },
            ],
            additionalSigners: [ownerKey],
        });

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

        await client.approveTokenAllowance({
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

        await client.approveNftAllowance({
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

        await waitForMirrorNodeRecord();

        const res = await fetch(
            `${MIRROR_URL}/api/v1/accounts/${owner.accountId}/allowances/nfts`,
        );
        const data = (await res.json()) as {
            allowances?: {
                owner: string;
                spender: string;
                token_id: string;
                serial_numbers?: number[];
                approved_for_all?: boolean;
            }[];
        };

        const match = (data.allowances ?? []).find(
            (a) => a.spender === spender.accountId && a.token_id === tokenId,
        );

        expect(match).toBeDefined();
        expect(match?.approved_for_all).not.toBe(true);
        expect(match?.serial_numbers ?? []).toEqual(
            expect.arrayContaining([1, 2]),
        );
    }, 30000);
});
