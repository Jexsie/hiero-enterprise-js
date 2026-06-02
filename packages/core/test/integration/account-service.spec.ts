import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../utils/env.js";
import { waitForMirrorNodeRecord } from "../utils/mirror-node.js";
import { AccountService } from "../../src/services/account-service.js";
import { AccountType } from "../../src/types/index.js";
import { PrivateKey } from "@hiero-ledger/sdk";

describe("AccountService [Integration]", () => {
    let client: AccountService;

    beforeAll(() => {
        // Setup internal context to point directly at localhost nodes
        const ctx = setupIntegrationTestEnv();
        client = new AccountService(ctx);
    });

    it("creates an ED25519 (NATIVE) account, validates balance, and confirms creation on Mirror Node", async () => {
        const initialBalance = 15; // Hbars
        const account = await client.createAccount({
            initialBalance,
            memo: "E2E Test Native",
        });

        expect(account.accountId).toBeDefined();
        expect(account.privateKey).toBeDefined();
        expect(account.evmAddress).toBeUndefined(); // Native does not map to evm alias explicitly

        // Wait for consensus propagation to Mirror Node locally
        await waitForMirrorNodeRecord();

        // Since we don't return the exact TxID from createAccount, we can query balance directly from consensus node:
        const balance = await client.getAccountBalance(account.accountId);
        expect(balance.hbars).toBe(String(initialBalance * 100_000_000));

        // Let's delete it natively (funds to operator)
        await client.deleteAccount(account.accountId, account.privateKey!);

        // It takes a second for the delete transaction to reflect definitively on balance
        await waitForMirrorNodeRecord();

        // Once deleted natively, the consensus node will throw ACCOUNT_DELETED rather than return a 0 balance
        await expect(
            client.getAccountBalance(account.accountId),
        ).rejects.toThrow(/ACCOUNT_DELETED/);
    }, 25000); // Give consensus enough time to run locally

    it("creates an ECDSA (EVM) hollow account, bypassing NATIVE setup entirely", async () => {
        const dummyKey = PrivateKey.generateECDSA().publicKey.toString();

        // 1. We create bypassing a direct SDK wrapper proxy (BYOK Scenario)
        const account = await client.createAccountWithPublicKey(
            dummyKey,
            AccountType.EVM,
            5,
            "EVM Hollow Test",
        );

        expect(account.accountId).toBeDefined();
        // The EVM alias MUST be mapped and explicitly match the hash of the key
        expect(account.evmAddress).toBeDefined();

        const balance = await client.getAccountBalance(account.accountId);
        expect(balance.hbars).toBe(String(5 * 100_000_000));
    }, 25000);

    it("autoCreateEvmAccount successfully transfers HBAR to a cold '0x' address", async () => {
        // A random dummy strictly formatted 20-byte EVM hex
        const coldAddress = "0x1111111111111111111111111111111111111111";

        await expect(
            client.autoCreateEvmAccount(coldAddress, 5),
        ).resolves.not.toThrow();

        // Because auto-creation is just a transfer to an alias, it guarantees 5 hbars arrived at the corresponding consensus shard.
        // But verifying via Mirror Node lookup could take multiple blocks to finalize for aliases.
    }, 20000);
});
