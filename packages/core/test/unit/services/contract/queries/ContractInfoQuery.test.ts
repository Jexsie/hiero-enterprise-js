import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContractInfoQuery as SdkContractInfoQuery } from "@hiero-ledger/sdk";
import { ContractService } from "../../../../../src/services/contract/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = vi.hoisted(() => {
    const info = {
        contractId: { toString: () => "0.0.12345" },
        contractMemo: "demo",
        isDeleted: false,
    };
    const query = {
        setContractId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(info),
    };
    return { query, info };
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        ContractInfoQuery: vi.fn(function () {
            return mocks.query;
        }),
    };
});

describe("ContractInfoQuery (via ContractService.getContractInfo)", () => {
    let context: IHieroContext;
    let service: ContractService;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.query.execute.mockResolvedValue(mocks.info);
        mocks.query.setContractId.mockReturnThis();
        context = createMockContext();
        service = new ContractService(context);
    });

    it("returns the SDK ContractInfo for the requested contract", async () => {
        const info = await service.getContractInfo("0.0.12345");

        expect(info).toBe(mocks.info);
        expect(vi.mocked(SdkContractInfoQuery)).toHaveBeenCalledTimes(1);
        expect(mocks.query.setContractId).toHaveBeenCalledWith("0.0.12345");
        expect(mocks.query.execute).toHaveBeenCalledWith(context.client);
    });

    it("wraps SDK execute() failures via normalizeError", async () => {
        mocks.query.execute.mockRejectedValueOnce(new Error("network down"));

        await expect(service.getContractInfo("0.0.12345")).rejects.toThrow(
            /network down/,
        );
    });
});
