import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import { waitForMirrorNodeRecord } from "../../../utils/mirror-node.js";
import { queryContractInfo } from "../../../utils/mirror-node-rest.js";
import { ContractService } from "../../../../src/services/index.js";

/**
 * Minimal compiled EVM bytecode for an empty Solidity contract — solc
 * `contract C {}` output. Keeps the per-test deploy cheap on the local
 * Solo network. The update tests don't invoke any contract function, so
 * a non-callable runtime is fine.
 */
const MINIMAL_BYTECODE_HEX =
    "6080604052348015600f57600080fd5b50603f80601d6000396000f3fe6080604052600080fdfea2646970667358221220a2eebb1bf7287900b84aeaa8e60fbaa256191b4028ce372ec0b7849e7b41e8c764736f6c63430008120033";

describe("ContractUpdateOperation", () => {
    let contractService: ContractService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        contractService = new ContractService(ctx);
    });

    /**
     * Deploy a fresh contract with an admin key so the update tests can
     * sign the update transaction. Operator pays for the create; the
     * admin key co-signs because the contract is being made mutable.
     */
    async function deployMutableContract(
        adminKey: PrivateKey,
    ): Promise<string> {
        return await contractService.createContract({
            bytecode: Buffer.from(MINIMAL_BYTECODE_HEX, "hex"),
            gas: 150_000,
            adminKey: adminKey.publicKey,
            contractMemo: "initial memo",
            additionalSigners: [adminKey],
        });
    }

    it("updates the contract memo", async () => {
        const adminKey = PrivateKey.generateED25519();
        const contractId = await deployMutableContract(adminKey);

        await contractService.updateContract({
            contractId,
            contractMemo: "renamed by update",
            additionalSigners: [adminKey],
        });

        await waitForMirrorNodeRecord();

        const info = await queryContractInfo(contractId);
        expect(info.memo).toBe("renamed by update");
    });

    it("updates the auto-renew period", async () => {
        const adminKey = PrivateKey.generateED25519();
        const contractId = await deployMutableContract(adminKey);

        const newPeriod = 7_948_800; // ~92 days, distinct from the default
        await contractService.updateContract({
            contractId,
            autoRenewPeriod: newPeriod,
            additionalSigners: [adminKey],
        });

        await waitForMirrorNodeRecord();

        const info = await queryContractInfo(contractId);
        expect(info.auto_renew_period).toBe(newPeriod);
    });

    it("updates the max automatic token associations", async () => {
        const adminKey = PrivateKey.generateED25519();
        const contractId = await deployMutableContract(adminKey);

        await contractService.updateContract({
            contractId,
            maxAutomaticTokenAssociations: 5,
            additionalSigners: [adminKey],
        });

        await waitForMirrorNodeRecord();

        const info = await queryContractInfo(contractId);
        expect(info.max_automatic_token_associations).toBe(5);
    });

    it("schedules a contract update and returns a scheduleId", async () => {
        const adminKey = PrivateKey.generateED25519();
        const contractId = await deployMutableContract(adminKey);

        const scheduled = await contractService.scheduleUpdateContract(
            {
                contractId,
                contractMemo: "scheduled rename",
                additionalSigners: [adminKey],
            },
            { scheduleMemo: "integration scheduled contract update" },
        );

        expect(scheduled.scheduleId).toMatch(/^0\.0\.\d+$/);
        expect(scheduled.transactionId).toBeDefined();
    });
});
