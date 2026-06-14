import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    AccountAllowanceApproveTransaction,
    AccountAllowanceDeleteTransaction,
    PrivateKey,
    Hbar,
    TokenId,
    NftId,
} from "@hiero-ledger/sdk";
import { AccountService } from "../../../../../src/services/account/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

// Covers `deleteHbarAllowance` + `deleteTokenAllowance` (both go through the
// approve-with-amount=0 trick on `AccountAllowanceApproveTransaction`) and
// `deleteNftAllowance` (per-serial revocation on
// `AccountAllowanceDeleteTransaction`).

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
        approveHbarAllowance: vi.fn().mockReturnThis(),
        approveTokenAllowance: vi.fn().mockReturnThis(),
        deleteAllTokenNftAllowances: vi.fn().mockReturnThis(),
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
        AccountAllowanceDeleteTransaction: vi.fn(function () {
            return mocks.mockTx;
        }),
    };
});

describe("DeleteAllowanceOperation (via AccountService)", () => {
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

    describe("deleteHbarAllowance", () => {
        it("revokes HBAR allowance by approving with amount=0", async () => {
            await service.deleteHbarAllowance([
                {
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.200",
                },
            ]);

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.approveHbarAllowance).toHaveBeenCalledTimes(1);
            expect(tx.approveHbarAllowance).toHaveBeenCalledWith(
                "0.0.100",
                "0.0.200",
                new Hbar(0),
            );
        });

        it("handles multiple HBAR allowance deletions", async () => {
            await service.deleteHbarAllowance([
                {
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.200",
                },
                {
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.300",
                },
            ]);

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.approveHbarAllowance).toHaveBeenCalledTimes(2);
            expect(tx.approveHbarAllowance).toHaveBeenCalledWith(
                "0.0.100",
                "0.0.200",
                new Hbar(0),
            );
            expect(tx.approveHbarAllowance).toHaveBeenCalledWith(
                "0.0.100",
                "0.0.300",
                new Hbar(0),
            );
        });

        it("forwards TransactionOptions (additionalSigners) to the executor", async () => {
            const ownerKey = PrivateKey.generateED25519();
            await service.deleteHbarAllowance(
                [
                    {
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                    },
                ],
                { additionalSigners: [ownerKey] },
            );

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(ownerKey);
        });
    });

    describe("deleteTokenAllowance", () => {
        it("revokes fungible token allowance by approving with amount=0", async () => {
            await service.deleteTokenAllowance([
                {
                    tokenId: "0.0.500",
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.200",
                },
            ]);

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.approveTokenAllowance).toHaveBeenCalledTimes(1);
            expect(tx.approveTokenAllowance).toHaveBeenCalledWith(
                "0.0.500",
                "0.0.100",
                "0.0.200",
                BigInt(0),
            );
        });

        it("handles multiple token allowance deletions for different tokens", async () => {
            await service.deleteTokenAllowance([
                {
                    tokenId: "0.0.500",
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.200",
                },
                {
                    tokenId: "0.0.501",
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.300",
                },
            ]);

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.approveTokenAllowance).toHaveBeenCalledTimes(2);
            expect(tx.approveTokenAllowance).toHaveBeenCalledWith(
                "0.0.500",
                "0.0.100",
                "0.0.200",
                BigInt(0),
            );
            expect(tx.approveTokenAllowance).toHaveBeenCalledWith(
                "0.0.501",
                "0.0.100",
                "0.0.300",
                BigInt(0),
            );
        });

        it("forwards TransactionOptions (additionalSigners) to the executor", async () => {
            const ownerKey = PrivateKey.generateED25519();
            await service.deleteTokenAllowance(
                [
                    {
                        tokenId: "0.0.500",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                    },
                ],
                { additionalSigners: [ownerKey] },
            );

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(ownerKey);
        });
    });

    describe("deleteNftAllowance", () => {
        it("deletes NFT allowance with correct SDK arguments per serial", async () => {
            await service.deleteNftAllowance([
                {
                    tokenId: "0.0.600",
                    ownerAccountId: "0.0.100",
                    serialNumbers: [1, 2, 3],
                },
            ]);

            const tx = vi.mocked(AccountAllowanceDeleteTransaction).mock
                .results[0].value;
            expect(tx.deleteAllTokenNftAllowances).toHaveBeenCalledTimes(3);
            expect(tx.deleteAllTokenNftAllowances).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.600"), 1),
                "0.0.100",
            );
            expect(tx.deleteAllTokenNftAllowances).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.600"), 2),
                "0.0.100",
            );
            expect(tx.deleteAllTokenNftAllowances).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.600"), 3),
                "0.0.100",
            );
        });

        it("handles multiple NFT allowance deletions for different tokens", async () => {
            await service.deleteNftAllowance([
                {
                    tokenId: "0.0.600",
                    ownerAccountId: "0.0.100",
                    serialNumbers: [1],
                },
                {
                    tokenId: "0.0.700",
                    ownerAccountId: "0.0.100",
                    serialNumbers: [5, 6],
                },
            ]);

            const tx = vi.mocked(AccountAllowanceDeleteTransaction).mock
                .results[0].value;
            expect(tx.deleteAllTokenNftAllowances).toHaveBeenCalledTimes(3);
            expect(tx.deleteAllTokenNftAllowances).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.600"), 1),
                "0.0.100",
            );
            expect(tx.deleteAllTokenNftAllowances).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.700"), 5),
                "0.0.100",
            );
            expect(tx.deleteAllTokenNftAllowances).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.700"), 6),
                "0.0.100",
            );
        });

        it("rejects when tokenId is missing", async () => {
            await expect(
                service.deleteNftAllowance([
                    {
                        tokenId: "",
                        ownerAccountId: "0.0.100",
                        serialNumbers: [1],
                    },
                ]),
            ).rejects.toThrow(/tokenId is required/);
        });

        it("rejects when ownerAccountId is missing", async () => {
            await expect(
                service.deleteNftAllowance([
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "",
                        serialNumbers: [1],
                    },
                ]),
            ).rejects.toThrow(/ownerAccountId is required/);
        });

        it("rejects when serialNumbers is empty", async () => {
            await expect(
                service.deleteNftAllowance([
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        serialNumbers: [],
                    },
                ]),
            ).rejects.toThrow(/serialNumbers must contain at least one entry/);
        });

        it("rejects with invalid serial numbers", async () => {
            await expect(
                service.deleteNftAllowance([
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        serialNumbers: [0],
                    },
                ]),
            ).rejects.toThrow(/positive integers/);

            await expect(
                service.deleteNftAllowance([
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        serialNumbers: [-1],
                    },
                ]),
            ).rejects.toThrow(/positive integers/);

            await expect(
                service.deleteNftAllowance([
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        serialNumbers: [1.5],
                    },
                ]),
            ).rejects.toThrow(/positive integers/);
        });
    });
});
