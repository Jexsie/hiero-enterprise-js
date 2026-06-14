import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    AccountAllowanceApproveTransaction,
    PrivateKey,
    TokenId,
} from "@hiero-ledger/sdk";
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
    const mockTx = {
        deleteTokenNftAllowanceAllSerials: vi.fn().mockReturnThis(),
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
    return { mockReceipt, mockResponse, mockTx };
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        AccountAllowanceApproveTransaction: vi.fn(function () {
            return mocks.mockTx;
        }),
    };
});

describe("DeleteAllNftAllowancesOperation (via AccountService)", () => {
    let context: IHieroContext;
    let service: AccountService;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mockResponse.getReceipt.mockResolvedValue(mocks.mockReceipt);
        mocks.mockTx.execute.mockResolvedValue(mocks.mockResponse);
        mocks.mockTx.sign.mockResolvedValue(undefined);

        context = createMockContext();
        service = new AccountService(context);
    });

    it("revokes approve-for-all-serials with correct SDK arguments", async () => {
        await service.deleteAllNftAllowances([
            {
                tokenId: "0.0.600",
                ownerAccountId: "0.0.100",
                spenderAccountId: "0.0.200",
            },
        ]);

        const tx = vi.mocked(AccountAllowanceApproveTransaction).mock.results[0]
            .value;
        expect(tx.deleteTokenNftAllowanceAllSerials).toHaveBeenCalledTimes(1);
        expect(tx.deleteTokenNftAllowanceAllSerials).toHaveBeenCalledWith(
            TokenId.fromString("0.0.600"),
            "0.0.100",
            "0.0.200",
        );
    });

    it("handles multiple approve-for-all-serials revocations", async () => {
        await service.deleteAllNftAllowances([
            {
                tokenId: "0.0.600",
                ownerAccountId: "0.0.100",
                spenderAccountId: "0.0.200",
            },
            {
                tokenId: "0.0.700",
                ownerAccountId: "0.0.100",
                spenderAccountId: "0.0.300",
            },
        ]);

        const tx = vi.mocked(AccountAllowanceApproveTransaction).mock.results[0]
            .value;
        expect(tx.deleteTokenNftAllowanceAllSerials).toHaveBeenCalledTimes(2);
        expect(tx.deleteTokenNftAllowanceAllSerials).toHaveBeenCalledWith(
            TokenId.fromString("0.0.600"),
            "0.0.100",
            "0.0.200",
        );
        expect(tx.deleteTokenNftAllowanceAllSerials).toHaveBeenCalledWith(
            TokenId.fromString("0.0.700"),
            "0.0.100",
            "0.0.300",
        );
    });

    it("forwards TransactionOptions (additionalSigners) to the executor", async () => {
        const ownerKey = PrivateKey.generateED25519();
        await service.deleteAllNftAllowances(
            [
                {
                    tokenId: "0.0.600",
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.200",
                },
            ],
            { additionalSigners: [ownerKey] },
        );

        const tx = vi.mocked(AccountAllowanceApproveTransaction).mock.results[0]
            .value;
        expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
        expect(tx.sign).toHaveBeenCalledWith(ownerKey);
    });

    it("rejects when tokenId is missing", async () => {
        await expect(
            service.deleteAllNftAllowances([
                {
                    tokenId: "",
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.200",
                },
            ]),
        ).rejects.toThrow(/tokenId is required/);
    });

    it("rejects when ownerAccountId is missing", async () => {
        await expect(
            service.deleteAllNftAllowances([
                {
                    tokenId: "0.0.600",
                    ownerAccountId: "",
                    spenderAccountId: "0.0.200",
                },
            ]),
        ).rejects.toThrow(/ownerAccountId is required/);
    });

    it("rejects when spenderAccountId is missing", async () => {
        await expect(
            service.deleteAllNftAllowances([
                {
                    tokenId: "0.0.600",
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "",
                },
            ]),
        ).rejects.toThrow(/spenderAccountId is required/);
    });
});
