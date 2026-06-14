import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountDeleteTransaction, PrivateKey } from "@hiero-ledger/sdk";
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
        setAccountId: vi.fn().mockReturnThis(),
        setTransferAccountId: vi.fn().mockReturnThis(),
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
        AccountDeleteTransaction: vi.fn(function () {
            return mocks.mockTx;
        }),
    };
});

describe("DeleteAccountOperation (via AccountService)", () => {
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

    describe("deleteAccount", () => {
        it("deletes an account and defaults transfer target to operator", async () => {
            const mockKey = PrivateKey.generateED25519();
            await service.deleteAccount({
                accountId: "0.0.999",
                accountKey: mockKey,
            });

            const tx = vi.mocked(AccountDeleteTransaction).mock.results[0]
                .value;
            expect(tx.setAccountId).toHaveBeenCalledWith("0.0.999");
            expect(tx.setTransferAccountId).toHaveBeenCalledWith("0.0.2");
        });

        it("deletes an account with a custom transfer target", async () => {
            const mockKey = PrivateKey.generateED25519();
            await service.deleteAccount({
                accountId: "0.0.999",
                accountKey: mockKey,
                transferAccountId: "0.0.555",
            });

            const tx = vi.mocked(AccountDeleteTransaction).mock.results[0]
                .value;
            expect(tx.setTransferAccountId).toHaveBeenCalledWith("0.0.555");
        });

        it("freezes and signs with accountKey before execute", async () => {
            const mockKey = PrivateKey.generateED25519();
            await service.deleteAccount({
                accountId: "0.0.999",
                accountKey: mockKey,
            });

            const tx = vi.mocked(AccountDeleteTransaction).mock.results[0]
                .value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(mockKey);
        });
    });

    describe("scheduleDeleteAccount", () => {
        it("schedules deletion without requiring accountKey", async () => {
            const result = await service.scheduleDeleteAccount({
                accountId: "0.0.999",
            });

            expect(mocks.mockTx.schedule).toHaveBeenCalled();
            expect(result.scheduleId).toBe("0.0.777");
        });
    });
});
