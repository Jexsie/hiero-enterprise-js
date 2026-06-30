import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContractByteCodeQuery as SdkContractByteCodeQuery } from "@hiero-ledger/sdk";
import { ContractService } from "../../../../../src/services/contract/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = vi.hoisted(() => {
    const bytecode = new Uint8Array([0x60, 0x80, 0x60, 0x40, 0x52]);
    const query = {
        setContractId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(bytecode),
    };
    return { query, bytecode };
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        ContractByteCodeQuery: vi.fn(function () {
            return mocks.query;
        }),
    };
});

describe("ContractBytecodeQuery (via ContractService.getContractBytecode)", () => {
    let context: IHieroContext;
    let service: ContractService;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.query.execute.mockResolvedValue(mocks.bytecode);
        mocks.query.setContractId.mockReturnThis();
        context = createMockContext();
        service = new ContractService(context);
    });

    it("returns the runtime bytecode for the requested contract", async () => {
        const bytecode = await service.getContractBytecode("0.0.12345");

        expect(bytecode).toBe(mocks.bytecode);
        expect(vi.mocked(SdkContractByteCodeQuery)).toHaveBeenCalledTimes(1);
        expect(mocks.query.setContractId).toHaveBeenCalledWith("0.0.12345");
        expect(mocks.query.execute).toHaveBeenCalledWith(context.client);
    });

    it("wraps SDK execute() failures via normalizeError", async () => {
        mocks.query.execute.mockRejectedValueOnce(new Error("network down"));

        await expect(service.getContractBytecode("0.0.12345")).rejects.toThrow(
            /network down/,
        );
    });
});
