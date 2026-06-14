import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import { waitForMirrorNodeRecord } from "../../../utils/mirror-node.js";
import { AccountService } from "../../../../src/services/index.js";
import { AccountType } from "../../../../src/types/index.js";

describe("AccountService.deleteAccount [Integration]", () => {
    let client: AccountService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = new AccountService(ctx);
    });

    it("deletes an existing account when given the account key", async () => {
        // Create a throw-away account we can delete in the same test
        const newKey = PrivateKey.generateED25519();
        const account = await client.createAccount({
            publicKey: newKey.publicKey.toString(),
            keyType: AccountType.ED25519,
            initialBalance: 5,
            memo: "Delete Account Integration Test",
        });
        await waitForMirrorNodeRecord();

        await client.deleteAccount({
            accountId: account.accountId,
            accountKey: newKey,
        });
        await waitForMirrorNodeRecord();

        await expect(
            client.getAccountBalance(account.accountId),
        ).rejects.toThrow(/ACCOUNT_DELETED/);
    });
});
