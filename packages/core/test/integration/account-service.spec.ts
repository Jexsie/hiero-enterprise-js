import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../utils/env.js";
import { waitForMirrorNodeRecord } from "../utils/mirror-node.js";
import { AccountService } from "../../src/services/index.js";
import { AccountType } from "../../src/types/index.js";
import { PrivateKey } from "@hiero-ledger/sdk";

describe("AccountService [Integration]", () => {
    let client: AccountService;

    beforeAll(() => {
        // Setup internal context to point directly at localhost nodes
        const ctx = setupIntegrationTestEnv();
        client = new AccountService(ctx);
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
    }, 30000);
});
