import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    NetworkVersionInfoQuery,
    TransactionId,
    TransactionReceiptQuery,
    TransactionRecordQuery,
} from "@hiero-ledger/sdk";
import { NetworkService } from "../../../../src/services/network/index.js";
import { createMockContext } from "../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../src/context/index.js";

interface MockQuery {
    setTransactionId: ReturnType<typeof vi.fn>;
    setIncludeChildren: ReturnType<typeof vi.fn>;
    setIncludeDuplicates: ReturnType<typeof vi.fn>;
    setMaxQueryPayment: ReturnType<typeof vi.fn>;
    setQueryPayment: ReturnType<typeof vi.fn>;
    setNodeAccountIds: ReturnType<typeof vi.fn>;
    setPaymentTransactionId: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
}

const mocks = await vi.hoisted(async () => {
    const { vi: viHoisted } = await import("vitest");

    const buildQuery = (result: unknown): MockQuery => ({
        setTransactionId: viHoisted.fn().mockReturnThis(),
        setIncludeChildren: viHoisted.fn().mockReturnThis(),
        setIncludeDuplicates: viHoisted.fn().mockReturnThis(),
        setMaxQueryPayment: viHoisted.fn().mockReturnThis(),
        setQueryPayment: viHoisted.fn().mockReturnThis(),
        setNodeAccountIds: viHoisted.fn().mockReturnThis(),
        setPaymentTransactionId: viHoisted.fn().mockReturnThis(),
        execute: viHoisted.fn().mockResolvedValue(result),
    });

    const receipt = { status: { toString: () => "SUCCESS" } };
    const record = {
        receipt,
        transactionId: { toString: () => "0.0.123@1700000000.000000000" },
    };
    const versionInfo = {
        protobufVersion: { major: 0, minor: 50, patch: 0 },
        servicesVersion: { major: 0, minor: 50, patch: 1 },
    };

    return {
        receiptQuery: buildQuery(receipt),
        recordQuery: buildQuery(record),
        versionQuery: buildQuery(versionInfo),
        receipt,
        record,
        versionInfo,
    };
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TransactionReceiptQuery: vi.fn(function () {
            return mocks.receiptQuery;
        }),
        TransactionRecordQuery: vi.fn(function () {
            return mocks.recordQuery;
        }),
        NetworkVersionInfoQuery: vi.fn(function () {
            return mocks.versionQuery;
        }),
    };
});

function reattachQueryChain(q: MockQuery, result: unknown): void {
    q.setTransactionId.mockReturnThis();
    q.setIncludeChildren.mockReturnThis();
    q.setIncludeDuplicates.mockReturnThis();
    q.setMaxQueryPayment.mockReturnThis();
    q.setQueryPayment.mockReturnThis();
    q.setNodeAccountIds.mockReturnThis();
    q.setPaymentTransactionId.mockReturnThis();
    q.execute.mockResolvedValue(result);
}

describe("NetworkService [facade contract]", () => {
    let context: IHieroContext;
    let service: NetworkService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachQueryChain(mocks.receiptQuery, mocks.receipt);
        reattachQueryChain(mocks.recordQuery, mocks.record);
        reattachQueryChain(mocks.versionQuery, mocks.versionInfo);

        context = createMockContext();
        service = new NetworkService(context);
    });

    describe("getTransactionReceipt", () => {
        it("instantiates a TransactionReceiptQuery and forwards the parsed transactionId", async () => {
            const result = await service.getTransactionReceipt({
                transactionId: "0.0.123@1700000000.000000000",
            });

            expect(TransactionReceiptQuery).toHaveBeenCalledTimes(1);
            const txIdArg =
                mocks.receiptQuery.setTransactionId.mock.calls[0][0];
            expect(txIdArg.toString()).toBe("0.0.123@1700000000.000000000");
            expect(result).toBe(mocks.receipt);
        });

        it("accepts a TransactionId instance without re-parsing", async () => {
            const txId = TransactionId.fromString(
                "0.0.456@1700000001.000000000",
            );

            await service.getTransactionReceipt({ transactionId: txId });

            expect(mocks.receiptQuery.setTransactionId).toHaveBeenCalledWith(
                txId,
            );
        });

        it("forwards includeChildren and includeDuplicates flags when set", async () => {
            await service.getTransactionReceipt({
                transactionId: "0.0.123@1700000000.000000000",
                includeChildren: true,
                includeDuplicates: true,
            });

            expect(mocks.receiptQuery.setIncludeChildren).toHaveBeenCalledWith(
                true,
            );
            expect(
                mocks.receiptQuery.setIncludeDuplicates,
            ).toHaveBeenCalledWith(true);
        });

        it("does not forward receipt-specific flags when omitted", async () => {
            await service.getTransactionReceipt({
                transactionId: "0.0.123@1700000000.000000000",
            });

            expect(
                mocks.receiptQuery.setIncludeChildren,
            ).not.toHaveBeenCalled();
            expect(
                mocks.receiptQuery.setIncludeDuplicates,
            ).not.toHaveBeenCalled();
        });

        it("emits lifecycle events with the receipt query type metadata", async () => {
            const beforeSpy = vi.spyOn(context, "emitBeforeTransaction");

            await service.getTransactionReceipt({
                transactionId: "0.0.123@1700000000.000000000",
            });

            expect(beforeSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "TransactionReceiptQuery",
                    serviceName: "NetworkService",
                    methodName: "getTransactionReceipt",
                    transactionId: "0.0.123@1700000000.000000000",
                }),
            );
        });
    });

    describe("getTransactionRecord", () => {
        it("instantiates a TransactionRecordQuery and forwards the parsed transactionId", async () => {
            const result = await service.getTransactionRecord({
                transactionId: "0.0.123@1700000000.000000000",
            });

            expect(TransactionRecordQuery).toHaveBeenCalledTimes(1);
            const txIdArg = mocks.recordQuery.setTransactionId.mock.calls[0][0];
            expect(txIdArg.toString()).toBe("0.0.123@1700000000.000000000");
            expect(result).toBe(mocks.record);
        });

        it("forwards includeChildren when set", async () => {
            await service.getTransactionRecord({
                transactionId: "0.0.123@1700000000.000000000",
                includeChildren: true,
            });

            expect(mocks.recordQuery.setIncludeChildren).toHaveBeenCalledWith(
                true,
            );
        });

        it("forwards includeDuplicates when set", async () => {
            await service.getTransactionRecord({
                transactionId: "0.0.123@1700000000.000000000",
                includeDuplicates: true,
            });

            expect(mocks.recordQuery.setIncludeDuplicates).toHaveBeenCalledWith(
                true,
            );
        });

        it("does not forward record-specific flags when omitted", async () => {
            await service.getTransactionRecord({
                transactionId: "0.0.123@1700000000.000000000",
            });

            expect(mocks.recordQuery.setIncludeChildren).not.toHaveBeenCalled();
            expect(
                mocks.recordQuery.setIncludeDuplicates,
            ).not.toHaveBeenCalled();
        });

        it("accepts a TransactionId instance without re-parsing", async () => {
            const txId = TransactionId.fromString(
                "0.0.456@1700000001.000000000",
            );

            await service.getTransactionRecord({ transactionId: txId });

            expect(mocks.recordQuery.setTransactionId).toHaveBeenCalledWith(
                txId,
            );
        });

        it("emits lifecycle events with the record query type metadata", async () => {
            const beforeSpy = vi.spyOn(context, "emitBeforeTransaction");

            await service.getTransactionRecord({
                transactionId: "0.0.123@1700000000.000000000",
            });

            expect(beforeSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "TransactionRecordQuery",
                    methodName: "getTransactionRecord",
                }),
            );
        });
    });

    describe("getNetworkVersionInfo", () => {
        it("instantiates a NetworkVersionInfoQuery and returns the version info", async () => {
            const result = await service.getNetworkVersionInfo();

            expect(NetworkVersionInfoQuery).toHaveBeenCalledTimes(1);
            expect(result).toBe(mocks.versionInfo);
        });

        it("emits lifecycle events with the version query type metadata", async () => {
            const beforeSpy = vi.spyOn(context, "emitBeforeTransaction");
            const afterSpy = vi.spyOn(context, "emitAfterTransaction");

            await service.getNetworkVersionInfo();

            expect(beforeSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "NetworkVersionInfoQuery",
                    serviceName: "NetworkService",
                    methodName: "getNetworkVersionInfo",
                }),
            );
            expect(afterSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "NetworkVersionInfoQuery",
                    status: "SUCCESS",
                }),
            );
        });
    });
});
