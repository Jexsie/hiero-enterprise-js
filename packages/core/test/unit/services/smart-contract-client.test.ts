import { describe, it, expect, vi, beforeEach } from "vitest";
import { SmartContractClient } from "../../../src/services/smart-contract-client.js";
import { createMockContext } from "../../utils/mock-context.js";
import type { HieroContext } from "../../../src/context/hiero-context.js";
import {
    ContractCreateTransaction,
    ContractCreateFlow,
    ContractExecuteTransaction,
    ContractDeleteTransaction,
} from "@hiero-ledger/sdk";

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@hiero-ledger/sdk")>();

    const mockContractResult = {
        gasUsed: { toNumber: () => 50000 },
        contractId: { toString: () => "0.0.999" },
        bytes: new Uint8Array([0xab, 0xcd]),
        errorMessage: "",
    };

    const mockTx = {
        setBytecodeFileId: vi.fn().mockReturnThis(),
        setBytecode: vi.fn().mockReturnThis(),
        setGas: vi.fn().mockReturnThis(),
        setConstructorParameters: vi.fn().mockReturnThis(),
        setContractId: vi.fn().mockReturnThis(),
        setFunction: vi.fn().mockReturnThis(),
        setPayableAmount: vi.fn().mockReturnThis(),
        setTransferAccountId: vi.fn().mockReturnThis(),
        setAdminKey: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({
            transactionId: { toString: () => "0.0.123@1234567890" },
            getReceipt: vi.fn().mockResolvedValue({
                status: { toString: () => "SUCCESS" },
                contractId: { toString: () => "0.0.999" },
            }),
            getRecord: vi.fn().mockResolvedValue({
                contractFunctionResult: mockContractResult,
            }),
        }),
    };

    return {
        ...actual,
        ContractCreateFlow: vi.fn(() => ({ ...mockTx })),
        ContractCreateTransaction: vi.fn(() => ({ ...mockTx })),
        ContractExecuteTransaction: vi.fn(() => ({ ...mockTx })),
        ContractDeleteTransaction: vi.fn(() => ({ ...mockTx })),
    };
});

describe("SmartContractClient", () => {
    let context: HieroContext;
    let client: SmartContractClient;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createMockContext();
        client = new SmartContractClient(context);
    });

    describe("createContract", () => {
        it("creates a contract from a file ID", async () => {
            const contractId = await client.createContract("0.0.888", 100000);

            expect(contractId).toBe("0.0.999");

            const txMock = vi.mocked(ContractCreateTransaction).mock.results[0]
                .value;
            expect(txMock.setBytecodeFileId).toHaveBeenCalled();
            expect(txMock.setGas).toHaveBeenCalledWith(100000);
            expect(txMock.execute).toHaveBeenCalledWith(context.client);
        });
    });

    describe("createContractFromBytecode", () => {
        it("creates a contract directly from bytecode", async () => {
            const bytecode = new Uint8Array([1, 2, 3, 4]);
            const contractId = await client.createContractFromBytecode(
                bytecode,
                200000,
            );

            expect(contractId).toBe("0.0.999");

            const txMock = vi.mocked(ContractCreateFlow).mock.results[0].value;
            expect(txMock.setBytecode).toHaveBeenCalledWith(bytecode);
            expect(txMock.setGas).toHaveBeenCalledWith(200000);
            expect(txMock.execute).toHaveBeenCalledWith(context.client);
        });
    });

    describe("callContractFunction", () => {
        it("calls a contract function (mutation)", async () => {
            const result = await client.callContractFunction(
                "0.0.999",
                "greet",
                100000,
            );

            expect(result.gasUsed).toBe(50000);
            expect(result.contractId).toBe("0.0.999");

            const txMock = vi.mocked(ContractExecuteTransaction).mock
                .results[0].value;
            expect(txMock.setContractId).toHaveBeenCalledWith("0.0.999");
            expect(txMock.setGas).toHaveBeenCalledWith(100000);
            expect(txMock.setFunction).toHaveBeenCalledWith(
                "greet",
                undefined,
            );
        });

        it("calls a contract function with payable hbars", async () => {
            await client.callContractFunction(
                "0.0.999",
                "deposit",
                100000,
                undefined,
                10,
            );

            const txMock = vi.mocked(ContractExecuteTransaction).mock
                .results[0].value;
            expect(txMock.setPayableAmount).toHaveBeenCalled();
        });
    });

    describe("deleteContract", () => {
        it("deletes a contract via account transfer", async () => {
            await client.deleteContract("0.0.999", "0.0.2");

            const txMock = vi.mocked(ContractDeleteTransaction).mock.results[0]
                .value;
            expect(txMock.setContractId).toHaveBeenCalledWith("0.0.999");
            expect(txMock.setTransferAccountId).toHaveBeenCalledWith("0.0.2");
            expect(txMock.execute).toHaveBeenCalledWith(context.client);
        });
    });
});
