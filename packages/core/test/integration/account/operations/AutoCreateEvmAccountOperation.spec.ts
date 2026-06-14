import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import { AccountService } from "../../../../src/services/index.js";

describe("AccountService.autoCreateEvmAccount [Integration]", () => {
    let client: AccountService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = new AccountService(ctx);
    });

    it("transfers HBAR to a cold '0x' address, auto-creating the account", async () => {
        // Generate a fresh 20-byte EVM address per run so we always exercise
        // the auto-create path rather than transferring to a pre-existing account
        // (Solo deployments persist across local runs).
        const coldAddress = `0x${randomBytes(20).toString("hex")}`;

        await expect(
            client.autoCreateEvmAccount({ evmAddress: coldAddress, amount: 5 }),
        ).resolves.not.toThrow();
    });
});
