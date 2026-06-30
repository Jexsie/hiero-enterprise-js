import { describe, it, expect, beforeAll } from "vitest";
import { PrivateKey } from "@hiero-ledger/sdk";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import { waitForMirrorNodeRecord } from "../../../utils/mirror-node.js";
import {
    queryContractInfo,
    type MirrorContractInfo,
} from "../../../utils/mirror-node-rest.js";
import { ContractService } from "../../../../src/services/index.js";

/**
 * Minimal compiled EVM bytecode for an empty Solidity contract — solc
 * `contract C {}` output. Small enough that the flow uploads it in a
 * single chunk; sufficient to exercise the file-create → contract-create
 * → file-delete sequence end-to-end on Solo.
 */
const MINIMAL_BYTECODE_HEX =
    "6080604052348015600f57600080fd5b50603f80601d6000396000f3fe6080604052600080fdfea2646970667358221220a2eebb1bf7287900b84aeaa8e60fbaa256191b4028ce372ec0b7849e7b41e8c764736f6c63430008120033";

/**
 * Polls the contract projection on the Mirror Node until `extract` returns
 * `expected`. `waitForMirrorNodeRecord` only confirms the *transaction*
 * propagated — the contract projection can lag by several seconds.
 */
async function waitForContractField<T>(
    contractId: string,
    extract: (info: MirrorContractInfo) => T,
    expected: T,
    maxRetries = 10,
    delayMs = 1000,
): Promise<T> {
    let last: T | undefined;
    for (let i = 0; i < maxRetries; i++) {
        const info = await queryContractInfo(contractId);
        last = extract(info);
        if (last === expected) return last;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error(
        `[Integration Test Timeout] Contract ${contractId} field did not match expected ${String(
            expected,
        )} after ${(maxRetries * delayMs) / 1000}s; last seen: ${String(last)}`,
    );
}

describe("ContractCreateFlowOperation", () => {
    let contractService: ContractService;

    beforeAll(() => {
        const ctx = setupIntegrationTestEnv();
        contractService = new ContractService(ctx);
    });

    it("deploys a contract end-to-end via the flow (file upload + create + cleanup)", async () => {
        const contractId = await contractService.createContractFlow({
            bytecode: Buffer.from(MINIMAL_BYTECODE_HEX, "hex"),
            gas: 150_000,
            contractMemo: "deployed via flow",
        });

        expect(contractId).toMatch(/^0\.0\.\d+$/);

        await waitForMirrorNodeRecord();

        const memo = await waitForContractField(
            contractId,
            (info) => info.memo,
            "deployed via flow",
        );
        expect(memo).toBe("deployed via flow");
    });

    it("deploys a mutable contract via the flow and signs with the admin key", async () => {
        const adminKey = PrivateKey.generateED25519();

        const contractId = await contractService.createContractFlow({
            bytecode: Buffer.from(MINIMAL_BYTECODE_HEX, "hex"),
            gas: 150_000,
            adminKey: adminKey.publicKey,
            contractMemo: "mutable flow contract",
            additionalSigners: [adminKey],
        });

        expect(contractId).toMatch(/^0\.0\.\d+$/);

        await waitForMirrorNodeRecord();

        const info = await queryContractInfo(contractId);
        expect(info.contract_id).toBe(contractId);
        // Admin key was set, so contract is not immutable.
        expect(info.deleted).toBe(false);
    });
});
