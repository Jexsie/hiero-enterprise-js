import { describe, it, expect, beforeAll } from "vitest";
import { setupIntegrationTestEnv } from "../../../utils/env.js";
import {
    ContractService,
    FileService,
} from "../../../../src/services/index.js";

/**
 * Minimal compiled EVM bytecode for an empty Solidity contract — solc
 * `contract C {}` output. Returns a zero-byte runtime to keep the deploy
 * cheap on the local Solo network.
 */
const MINIMAL_BYTECODE_HEX =
    "6080604052348015600f57600080fd5b50603f80601d6000396000f3fe6080604052600080fdfea2646970667358221220a2eebb1bf7287900b84aeaa8e60fbaa256191b4028ce372ec0b7849e7b41e8c764736f6c63430008120033";

describe("ContractCreateOperation", () => {
    let fileService: FileService;
    let contractService: ContractService;
    let bytecodeFileId: string;

    beforeAll(async () => {
        const ctx = setupIntegrationTestEnv();
        fileService = new FileService(ctx);
        contractService = new ContractService(ctx);

        // Upload the bytecode hex string as UTF-8 bytes — Hiero's file-based
        // contract deploy expects the file contents to be the hex-encoded
        // bytecode (the network decodes it server-side). Uploading raw decoded
        // bytes triggers ERROR_DECODING_BYTESTRING at ContractCreate time.
        bytecodeFileId = await fileService.createFile({
            contents: Buffer.from(MINIMAL_BYTECODE_HEX, "utf8"),
        });
    });

    it("deploys a contract from a pre-uploaded bytecode FileId", async () => {
        const contractId = await contractService.createContract({
            bytecodeFileId,
            gas: 150_000,
        });

        expect(contractId).toBeDefined();
        expect(contractId).toMatch(/^0\.0\.\d+$/);
    });

    it("deploys a contract from raw bytecode embedded in-transaction (HIP-435)", async () => {
        const contractId = await contractService.createContract({
            bytecode: Buffer.from(MINIMAL_BYTECODE_HEX, "hex"),
            gas: 150_000,
        });

        expect(contractId).toBeDefined();
        expect(contractId).toMatch(/^0\.0\.\d+$/);
    });

    it("deploys a contract with a memo recorded on the entity", async () => {
        const contractId = await contractService.createContract({
            bytecodeFileId,
            gas: 150_000,
            contractMemo: "integration test contract",
        });

        expect(contractId).toBeDefined();
        expect(contractId).toMatch(/^0\.0\.\d+$/);
    });
});
