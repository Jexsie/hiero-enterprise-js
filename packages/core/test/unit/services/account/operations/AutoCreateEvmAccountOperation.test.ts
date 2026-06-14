import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountService } from "../../../../../src/services/account/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = vi.hoisted(() => {
    const mockReceipt = {
        status: { toString: () => "SUCCESS" },
        accountId: { toString: () => "0.0.999" },
        scheduleId: { toString: () => "0.0.777" },
    };
    const mockResponse = {
        transactionId: { toString: () => "0.0.123@1234567890.000000000" },
        getReceipt: vi.fn().mockResolvedValue(mockReceipt),
    };
    const mockScheduleTx = {
        setPayerAccountId: vi.fn().mockReturnThis(),
        setAdminKey: vi.fn().mockReturnThis(),
        setScheduleMemo: vi.fn().mockReturnThis(),
        setMaxTransactionFee: vi.fn().mockReturnThis(),
        setTransactionMemo: vi.fn().mockReturnThis(),
        setTransactionValidDuration: vi.fn().mockReturnThis(),
        setRegenerateTransactionId: vi.fn().mockReturnThis(),
        setHighVolume: vi.fn().mockReturnThis(),
        setNodeAccountIds: vi.fn().mockReturnThis(),
        _addSignatureLegacy: vi.fn().mockReturnThis(),
        freezeWith: vi.fn().mockReturnThis(),
        sign: vi.fn().mockResolvedValue(undefined),
        signWith: vi.fn().mockResolvedValue(undefined),
        execute: vi.fn().mockResolvedValue(mockResponse),
    };
    const mockTx = {
        addHbarTransfer: vi.fn().mockReturnThis(),
        setMaxTransactionFee: vi.fn().mockReturnThis(),
        setTransactionMemo: vi.fn().mockReturnThis(),
        setTransactionValidDuration: vi.fn().mockReturnThis(),
        setRegenerateTransactionId: vi.fn().mockReturnThis(),
        setHighVolume: vi.fn().mockReturnThis(),
        setNodeAccountIds: vi.fn().mockReturnThis(),
        _addSignatureLegacy: vi.fn().mockReturnThis(),
        freezeWith: vi.fn().mockReturnThis(),
        sign: vi.fn().mockResolvedValue(undefined),
        signWith: vi.fn().mockResolvedValue(undefined),
        schedule: vi.fn().mockReturnValue(mockScheduleTx),
        execute: vi.fn().mockResolvedValue(mockResponse),
    };
    return { mockReceipt, mockResponse, mockScheduleTx, mockTx };
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TransferTransaction: vi.fn(function () {
            return mocks.mockTx;
        }),
    };
});

describe("AutoCreateEvmAccountOperation (via AccountService)", () => {
    let context: IHieroContext;
    let service: AccountService;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mockResponse.getReceipt.mockResolvedValue(mocks.mockReceipt);
        mocks.mockTx.execute.mockResolvedValue(mocks.mockResponse);
        mocks.mockTx.sign.mockResolvedValue(undefined);
        mocks.mockTx.schedule.mockReturnValue(mocks.mockScheduleTx);
        mocks.mockScheduleTx.execute.mockResolvedValue(mocks.mockResponse);
        mocks.mockScheduleTx.sign.mockResolvedValue(undefined);

        context = createMockContext();
        service = new AccountService(context);
    });

    describe("autoCreateEvmAccount", () => {
        it("transfers HBAR to seed the EVM address", async () => {
            await service.autoCreateEvmAccount({
                evmAddress: "0x" + "a".repeat(40),
                amount: 5,
            });

            expect(mocks.mockTx.addHbarTransfer).toHaveBeenCalledTimes(2);
            expect(mocks.mockTx.execute).toHaveBeenCalledWith(context.client);
        });
    });

    describe("scheduleAutoCreateEvmAccount", () => {
        it("schedules the hollow-account transfer", async () => {
            const result = await service.scheduleAutoCreateEvmAccount({
                evmAddress: "0x" + "a".repeat(40),
                amount: 5,
            });

            expect(mocks.mockTx.schedule).toHaveBeenCalled();
            expect(result.scheduleId).toBe("0.0.777");
        });
    });
});
