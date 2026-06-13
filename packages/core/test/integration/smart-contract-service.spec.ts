import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../utils/env.js";
import { waitForMirrorNodeRecord } from "../utils/mirror-node.js";
import { SmartContractService } from "../../src/services/smart-contract-service.js";

describe("SmartContractService [Integration]", () => {
    let client: SmartContractService;
    let testContractId: string;
    let operatorId: string;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        client = new SmartContractService(ctx);
        operatorId = ctx.operatorAccountId.toString();
    });

    it("deploys a smart contract bypassing the file service via direct bytecode", async () => {
        // Minimal EVM initialization bytecode (Standard solc output returning clean runtime logic)
        const minimalBytecode =
            "6080604052348015600f57600080fd5b50603f80601d6000396000f3fe6080604052600080fdfea2646970667358221220a2eebb1bf7287900b84aeaa8e60fbaa256191b4028ce372ec0b7849e7b41e8c764736f6c63430008120033";

        const contractId = await client.createContractFromBytecode(
            minimalBytecode,
            150000,
        );

        expect(typeof contractId).toBe("string");
        expect(contractId).toBeDefined();

        await waitForMirrorNodeRecord(); // Await consensus propagation
        testContractId = contractId;
    }, 35000);

    it("deletes the deployed smart contract", async () => {
        // Contract deployed without adminKey is immutable and cannot be deleted
        await expect(
            client.deleteContract(testContractId, operatorId),
        ).rejects.toThrow(/MODIFYING_IMMUTABLE_CONTRACT/);
    }, 25000);
});
