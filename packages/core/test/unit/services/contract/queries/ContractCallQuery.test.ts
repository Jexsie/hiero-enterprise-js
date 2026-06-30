import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    ContractCallQuery as SdkContractCallQuery,
    ContractFunctionParameters,
} from "@hiero-ledger/sdk";
import { ContractService } from "../../../../../src/services/contract/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = vi.hoisted(() => {
    const result = {
        gasUsed: 1_234,
        bytes: new Uint8Array([0x00]),
        getUint256: vi.fn().mockReturnValue(42),
    };
    const query = {
        setContractId: vi.fn().mockReturnThis(),
        setGas: vi.fn().mockReturnThis(),
        setFunction: vi.fn().mockReturnThis(),
        setFunctionParameters: vi.fn().mockReturnThis(),
        setSenderAccountId: vi.fn().mockReturnThis(),
        setMaxResultSize: vi.fn().mockReturnThis(),
        setQueryPayment: vi.fn().mockReturnThis(),
        setMaxQueryPayment: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(result),
    };
    return { query, result };
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        ContractCallQuery: vi.fn(function () {
            return mocks.query;
        }),
    };
});

describe("ContractCallQuery (via ContractService.callContract)", () => {
    let context: IHieroContext;
    let service: ContractService;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.query.execute.mockResolvedValue(mocks.result);
        for (const [name, fn] of Object.entries(mocks.query)) {
            if (name !== "execute") {
                fn.mockReturnThis();
            }
        }
        context = createMockContext();
        service = new ContractService(context);
    });

    it("submits a call with functionName and returns the SDK result", async () => {
        const result = await service.callContract({
            contractId: "0.0.12345",
            gas: 50_000,
            functionName: "get",
        });

        expect(result).toBe(mocks.result);
        expect(vi.mocked(SdkContractCallQuery)).toHaveBeenCalledTimes(1);
        expect(mocks.query.setContractId).toHaveBeenCalledWith("0.0.12345");
        expect(mocks.query.setGas).toHaveBeenCalledWith(50_000);
        expect(mocks.query.setFunction).toHaveBeenCalledWith("get", undefined);
        expect(mocks.query.execute).toHaveBeenCalledWith(context.client);
    });

    it("forwards ABI-typed functionParameters when supplied", async () => {
        const params = new ContractFunctionParameters().addUint256(7);

        await service.callContract({
            contractId: "0.0.12345",
            gas: 50_000,
            functionName: "set",
            functionParameters: params,
        });

        expect(mocks.query.setFunction).toHaveBeenCalledWith("set", params);
        expect(mocks.query.setFunctionParameters).not.toHaveBeenCalled();
    });

    it("forwards rawFunctionParameters when supplied", async () => {
        const raw = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

        await service.callContract({
            contractId: "0.0.12345",
            gas: 50_000,
            rawFunctionParameters: raw,
        });

        expect(mocks.query.setFunctionParameters).toHaveBeenCalledWith(raw);
        expect(mocks.query.setFunction).not.toHaveBeenCalled();
    });

    it("forwards every optional setter when supplied", async () => {
        await service.callContract({
            contractId: "0.0.12345",
            gas: 50_000,
            functionName: "get",
            senderAccountId: "0.0.999",
            maxResultSize: 8_192,
        });

        expect(mocks.query.setSenderAccountId).toHaveBeenCalledWith("0.0.999");
        expect(mocks.query.setMaxResultSize).toHaveBeenCalledWith(8_192);
    });

    it("forwards queryPayment + maxQueryPayment when supplied", async () => {
        const payment = { _tinybars: 1 } as never;
        const cap = { _tinybars: 100 } as never;

        await service.callContract({
            contractId: "0.0.12345",
            gas: 50_000,
            functionName: "get",
            queryPayment: payment,
            maxQueryPayment: cap,
        });

        expect(mocks.query.setQueryPayment).toHaveBeenCalledWith(payment);
        expect(mocks.query.setMaxQueryPayment).toHaveBeenCalledWith(cap);
    });

    it("rejects when neither functionName nor rawFunctionParameters is supplied", async () => {
        await expect(
            service.callContract({
                contractId: "0.0.12345",
                gas: 50_000,
            }),
        ).rejects.toThrow(
            /requires either functionName or rawFunctionParameters/,
        );

        expect(vi.mocked(SdkContractCallQuery)).not.toHaveBeenCalled();
    });

    it("rejects when both functionName and rawFunctionParameters are supplied", async () => {
        await expect(
            service.callContract({
                contractId: "0.0.12345",
                gas: 50_000,
                functionName: "get",
                rawFunctionParameters: new Uint8Array([0x01]),
            }),
        ).rejects.toThrow(
            /accepts functionName or rawFunctionParameters, not both/,
        );

        expect(vi.mocked(SdkContractCallQuery)).not.toHaveBeenCalled();
    });

    it("wraps SDK execute() failures via normalizeError", async () => {
        mocks.query.execute.mockRejectedValueOnce(new Error("network down"));

        await expect(
            service.callContract({
                contractId: "0.0.12345",
                gas: 50_000,
                functionName: "get",
            }),
        ).rejects.toThrow(/network down/);
    });
});
