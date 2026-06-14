import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountService } from "../../../src/services/account/index.js";
import { AccountType } from "../../../src/types/index.js";
import { createMockContext } from "../../utils/mock-context.js";
import type { IHieroContext } from "../../../src/context/index.js";
import {
    AccountCreateTransaction,
    AccountDeleteTransaction,
    AccountAllowanceApproveTransaction,
    AccountAllowanceDeleteTransaction,
    PrivateKey,
    Hbar,
    TokenId,
    NftId,
    AccountId,
} from "@hiero-ledger/sdk";

// ─── Shared mock fixtures ───────────────────────────────────────────────────

const mockReceipt = {
    status: { toString: () => "SUCCESS" },
    accountId: { toString: () => "0.0.999" },
    scheduleId: { toString: () => "0.0.777" },
};

const mockResponse = {
    transactionId: { toString: () => "0.0.123@1234567890.000000000" },
    getReceipt: vi.fn().mockResolvedValue(mockReceipt),
};

// ScheduleCreateTransaction mock — returned by tx.schedule()
const mockScheduleTx = {
    setPayerAccountId: vi.fn().mockReturnThis(),
    setAdminKey: vi.fn().mockReturnThis(),
    setScheduleMemo: vi.fn().mockReturnThis(),
    // Base transaction methods the executor may call
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

// Base transaction mock used by all SDK transaction classes
const mockTx = {
    // AccountCreateTransaction setters
    setKeyWithoutAlias: vi.fn().mockReturnThis(),
    setECDSAKeyWithAlias: vi.fn().mockReturnThis(),
    setKeyWithAlias: vi.fn().mockReturnThis(),
    setInitialBalance: vi.fn().mockReturnThis(),
    setMaxAutomaticTokenAssociations: vi.fn().mockReturnThis(),
    setAccountMemo: vi.fn().mockReturnThis(),
    setReceiverSignatureRequired: vi.fn().mockReturnThis(),
    setStakedAccountId: vi.fn().mockReturnThis(),
    setStakedNodeId: vi.fn().mockReturnThis(),
    setDeclineStakingReward: vi.fn().mockReturnThis(),
    // AccountDeleteTransaction setters
    setAccountId: vi.fn().mockReturnThis(),
    setTransferAccountId: vi.fn().mockReturnThis(),
    // TransferTransaction setters
    addHbarTransfer: vi.fn().mockReturnThis(),
    // AccountAllowanceApproveTransaction setters
    approveHbarAllowance: vi.fn().mockReturnThis(),
    approveTokenAllowance: vi.fn().mockReturnThis(),
    approveTokenNftAllowance: vi.fn().mockReturnThis(),
    approveTokenNftAllowanceAllSerials: vi.fn().mockReturnThis(),
    approveTokenNftAllowanceWithDelegatingSpender: vi.fn().mockReturnThis(),
    deleteTokenNftAllowanceAllSerials: vi.fn().mockReturnThis(),
    // AccountAllowanceDeleteTransaction setters
    deleteAllTokenNftAllowances: vi.fn().mockReturnThis(),
    // Base Transaction methods the executor calls
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
    // schedule() wraps this tx in a ScheduleCreateTransaction
    schedule: vi.fn().mockReturnValue(mockScheduleTx),
    execute: vi.fn().mockResolvedValue(mockResponse),
};

const mockQuery = {
    setAccountId: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({
        hbars: { toTinybars: () => ({ toString: () => "1000000" }) },
        tokens: null,
        tokenDecimals: null,
    }),
};

// Mock the entire SDK so no real network calls are made
vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        AccountCreateTransaction: vi.fn(function () {
            return mockTx;
        }),
        AccountDeleteTransaction: vi.fn(function () {
            return mockTx;
        }),
        AccountBalanceQuery: vi.fn(function () {
            return mockQuery;
        }),
        TransferTransaction: vi.fn(function () {
            return mockTx;
        }),
        AccountAllowanceApproveTransaction: vi.fn(function () {
            return mockTx;
        }),
        AccountAllowanceDeleteTransaction: vi.fn(function () {
            return mockTx;
        }),
    };
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("AccountService", () => {
    let context: IHieroContext;
    let service: AccountService;

    beforeEach(() => {
        vi.clearAllMocks();
        // Restore resolved values that clearAllMocks resets
        mockResponse.getReceipt.mockResolvedValue(mockReceipt);
        mockTx.execute.mockResolvedValue(mockResponse);
        mockTx.sign.mockResolvedValue(undefined);
        mockTx.schedule.mockReturnValue(mockScheduleTx);
        mockScheduleTx.execute.mockResolvedValue(mockResponse);
        mockScheduleTx.sign.mockResolvedValue(undefined);

        context = createMockContext();
        service = new AccountService(context);
    });

    // ── createAccount ────────────────────────────────────────────────────────

    describe("createAccount", () => {
        it("creates an account with an ED25519 key (default keyType)", async () => {
            const pubKey = PrivateKey.generateED25519().publicKey.toString();
            const account = await service.createAccount({ publicKey: pubKey });

            expect(account.accountId).toBe("0.0.999");
            expect(account.publicKey).toBeDefined();
            expect(account.evmAddress).toBeUndefined();

            const tx = vi.mocked(AccountCreateTransaction).mock.results[0]
                .value;
            expect(tx.setKeyWithoutAlias).toHaveBeenCalled();
            expect(tx.setInitialBalance).toHaveBeenCalled();
            expect(tx.execute).toHaveBeenCalledWith(context.client);
        });

        it("creates an ECDSA account with alias derived from the key", async () => {
            const pubKey = PrivateKey.generateECDSA().publicKey.toString();
            await service.createAccount({
                publicKey: pubKey,
                keyType: AccountType.ECDSA,
                alias: true,
                initialBalance: 5,
            });

            const tx = vi.mocked(AccountCreateTransaction).mock.results[0]
                .value;
            expect(tx.setECDSAKeyWithAlias).toHaveBeenCalled();
            expect(tx.setKeyWithoutAlias).not.toHaveBeenCalled();
        });

        it("creates an account with a separate alias key (two-key pattern)", async () => {
            const primaryKey =
                PrivateKey.generateED25519().publicKey.toString();
            const aliasKey = PrivateKey.generateECDSA().publicKey.toString();

            await service.createAccount({
                publicKey: primaryKey,
                keyType: AccountType.ED25519,
                alias: { ecdsaPublicKey: aliasKey },
            });

            const tx = vi.mocked(AccountCreateTransaction).mock.results[0]
                .value;
            expect(tx.setKeyWithAlias).toHaveBeenCalled();
            expect(tx.setKeyWithoutAlias).not.toHaveBeenCalled();
            expect(tx.setECDSAKeyWithAlias).not.toHaveBeenCalled();
        });

        it("throws if alias: true is used with an ED25519 key", async () => {
            const pubKey = PrivateKey.generateED25519().publicKey.toString();

            await expect(
                service.createAccount({
                    publicKey: pubKey,
                    keyType: AccountType.ED25519,
                    alias: true,
                }),
            ).rejects.toThrow(/requires keyType AccountType.ECDSA/);
        });

        it("sets all optional properties when provided", async () => {
            const pubKey = PrivateKey.generateED25519().publicKey.toString();
            await service.createAccount({
                publicKey: pubKey,
                initialBalance: 10,
                receiverSignatureRequired: true,
                memo: "test memo",
                maxAutomaticTokenAssociations: 5,
                stakedNodeId: 3,
                declineStakingReward: true,
            });

            const tx = vi.mocked(AccountCreateTransaction).mock.results[0]
                .value;
            expect(tx.setReceiverSignatureRequired).toHaveBeenCalledWith(true);
            expect(tx.setAccountMemo).toHaveBeenCalledWith("test memo");
            expect(tx.setMaxAutomaticTokenAssociations).toHaveBeenCalledWith(5);
            expect(tx.setStakedNodeId).toHaveBeenCalledWith(3);
            expect(tx.setDeclineStakingReward).toHaveBeenCalledWith(true);
        });

        it("sets stakedAccountId when provided", async () => {
            const pubKey = PrivateKey.generateED25519().publicKey.toString();
            await service.createAccount({
                publicKey: pubKey,
                stakedAccountId: "0.0.800",
            });

            const tx = vi.mocked(AccountCreateTransaction).mock.results[0]
                .value;
            expect(tx.setStakedAccountId).toHaveBeenCalledWith("0.0.800");
        });

        it("applies base TransactionOptions to the transaction", async () => {
            const pubKey = PrivateKey.generateED25519().publicKey.toString();
            await service.createAccount({
                publicKey: pubKey,
                transactionMemo: "base memo",
                transactionValidDuration: 90,
                regenerateTransactionId: false,
            });

            const tx = vi.mocked(AccountCreateTransaction).mock.results[0]
                .value;
            expect(tx.setTransactionMemo).toHaveBeenCalledWith("base memo");
            expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(90);
            expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        });

        it("freezes and signs with additionalSigners before execute", async () => {
            const pubKey = PrivateKey.generateED25519().publicKey.toString();
            const extraKey = PrivateKey.generateED25519();

            await service.createAccount({
                publicKey: pubKey,
                additionalSigners: [extraKey],
            });

            const tx = vi.mocked(AccountCreateTransaction).mock.results[0]
                .value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(extraKey);
        });
    });

    // ── scheduleCreateAccount ────────────────────────────────────────────────

    describe("scheduleCreateAccount", () => {
        it("wraps the transaction in a ScheduleCreateTransaction", async () => {
            const pubKey = PrivateKey.generateED25519().publicKey.toString();
            const result = await service.scheduleCreateAccount(
                { publicKey: pubKey },
                { scheduleMemo: "pending approval" },
            );

            expect(mockTx.schedule).toHaveBeenCalled();
            expect(mockScheduleTx.setScheduleMemo).toHaveBeenCalledWith(
                "pending approval",
            );
            expect(result.scheduleId).toBe("0.0.777");
            expect(result.transactionId).toBeDefined();
        });
    });

    // ── deleteAccount ────────────────────────────────────────────────────────

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
            // Executor freezes first when there are additionalSigners
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(mockKey);
        });
    });

    // ── scheduleDeleteAccount ────────────────────────────────────────────────

    describe("scheduleDeleteAccount", () => {
        it("schedules deletion without requiring accountKey", async () => {
            const result = await service.scheduleDeleteAccount({
                accountId: "0.0.999",
            });

            expect(mockTx.schedule).toHaveBeenCalled();
            expect(result.scheduleId).toBe("0.0.777");
        });
    });

    // ── autoCreateEvmAccount ─────────────────────────────────────────────────

    describe("autoCreateEvmAccount", () => {
        it("transfers HBAR to seed the EVM address", async () => {
            await service.autoCreateEvmAccount({
                evmAddress: "0x" + "a".repeat(40),
                amount: 5,
            });

            expect(mockTx.addHbarTransfer).toHaveBeenCalledTimes(2);
            expect(mockTx.execute).toHaveBeenCalledWith(context.client);
        });
    });

    // ── scheduleAutoCreateEvmAccount ─────────────────────────────────────────

    describe("scheduleAutoCreateEvmAccount", () => {
        it("schedules the hollow-account transfer", async () => {
            const result = await service.scheduleAutoCreateEvmAccount({
                evmAddress: "0x" + "a".repeat(40),
                amount: 5,
            });

            expect(mockTx.schedule).toHaveBeenCalled();
            expect(result.scheduleId).toBe("0.0.777");
        });
    });

    // ── getAccountBalance ────────────────────────────────────────────────────

    describe("getAccountBalance", () => {
        it("fetches the account balance", async () => {
            const balance = await service.getAccountBalance("0.0.999");

            expect(balance.accountId).toBe("0.0.999");
            expect(balance.hbars).toBe("1000000");
            expect(balance.tokens).toEqual([]);
        });
    });

    // ── getOperatorAccountBalance ────────────────────────────────────────────

    describe("getOperatorAccountBalance", () => {
        it("fetches the operator balance", async () => {
            const balance = await service.getOperatorAccountBalance();

            expect(balance.accountId).toBe("0.0.2");
            expect(balance.hbars).toBe("1000000");
        });
    });

    // approveHbarAllowance

    describe("approveHbarAllowance", () => {
        it("approves an HBAR allowance with correct SDK arguments", async () => {
            await service.approveHbarAllowance({
                hbarAllowances: [
                    {
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        amount: 10,
                    },
                ],
            });

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.approveHbarAllowance).toHaveBeenCalledWith(
                "0.0.100",
                "0.0.200",
                new Hbar(10),
            );
            expect(tx.execute).toHaveBeenCalledWith(context.client);
        });

        it("freezes and signs with additionalSigners", async () => {
            const ownerKey = PrivateKey.generateED25519();

            await service.approveHbarAllowance({
                hbarAllowances: [
                    {
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        amount: 5,
                    },
                ],
                additionalSigners: [ownerKey],
            });

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(ownerKey);
        });
    });

    // approveTokenAllowance

    describe("approveTokenAllowance", () => {
        it("approves a fungible token allowance with correct SDK arguments", async () => {
            await service.approveTokenAllowance({
                tokenAllowances: [
                    {
                        tokenId: "0.0.500",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        amount: 5000,
                    },
                ],
            });

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.approveTokenAllowance).toHaveBeenCalledWith(
                "0.0.500",
                "0.0.100",
                "0.0.200",
                BigInt(5000),
            );
        });
    });

    // approveNftAllowance

    describe("approveNftAllowance", () => {
        it("approves NFT allowance with correct SDK arguments per serial", async () => {
            await service.approveNftAllowance({
                nftAllowances: [
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        serialNumbers: [1, 2, 3],
                    },
                ],
            });

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.approveTokenNftAllowance).toHaveBeenCalledTimes(3);
            expect(tx.approveTokenNftAllowance).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.600"), 1),
                "0.0.100",
                "0.0.200",
            );
            expect(tx.approveTokenNftAllowance).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.600"), 2),
                "0.0.100",
                "0.0.200",
            );
            expect(tx.approveTokenNftAllowance).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.600"), 3),
                "0.0.100",
                "0.0.200",
            );
        });

        it("approves NFT allowance for all serials with correct SDK arguments", async () => {
            await service.approveNftAllowance({
                nftAllowances: [
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        allSerials: true,
                    },
                ],
            });

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.approveTokenNftAllowanceAllSerials).toHaveBeenCalledWith(
                TokenId.fromString("0.0.600"),
                "0.0.100",
                "0.0.200",
            );
        });

        it("calls approveTokenNftAllowanceWithDelegatingSpender with correct SDK arguments", async () => {
            await service.approveNftAllowance({
                nftAllowances: [
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        serialNumbers: [1, 2],
                        delegatingSpender: "0.0.300",
                    },
                ],
            });

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(
                tx.approveTokenNftAllowanceWithDelegatingSpender,
            ).toHaveBeenCalledTimes(2);
            expect(
                tx.approveTokenNftAllowanceWithDelegatingSpender,
            ).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.600"), 1),
                "0.0.100",
                AccountId.fromString("0.0.200"),
                "0.0.300",
            );
            expect(
                tx.approveTokenNftAllowanceWithDelegatingSpender,
            ).toHaveBeenCalledWith(
                new NftId(TokenId.fromString("0.0.600"), 2),
                "0.0.100",
                AccountId.fromString("0.0.200"),
                "0.0.300",
            );
            expect(tx.approveTokenNftAllowance).not.toHaveBeenCalled();
        });

        it("ignores delegatingSpender when allSerials is true", async () => {
            await service.approveNftAllowance({
                nftAllowances: [
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                        allSerials: true,
                        delegatingSpender: "0.0.300",
                    },
                ],
            });

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.approveTokenNftAllowanceAllSerials).toHaveBeenCalled();
            expect(
                tx.approveTokenNftAllowanceWithDelegatingSpender,
            ).not.toHaveBeenCalled();
        });
    });

    // allowance validation

    describe("allowance validation", () => {
        it("rejects approveHbarAllowance when hbarAllowances is empty", async () => {
            await expect(
                service.approveHbarAllowance({
                    hbarAllowances: [],
                }),
            ).rejects.toThrow(/hbarAllowances must be provided/);
        });

        it("rejects approveTokenAllowance when tokenAllowances is empty", async () => {
            await expect(
                service.approveTokenAllowance({
                    tokenAllowances: [],
                }),
            ).rejects.toThrow(/tokenAllowances must be provided/);
        });

        it("rejects approveNftAllowance when nftAllowances is empty", async () => {
            await expect(
                service.approveNftAllowance({
                    nftAllowances: [],
                }),
            ).rejects.toThrow(/nftAllowances must be provided/);
        });
    });

    // deleteHbarAllowance

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

        it("rejects deleteHbarAllowance when allowances is empty", async () => {
            await expect(service.deleteHbarAllowance([])).rejects.toThrow(
                /hbarAllowances must be provided/,
            );
        });
    });

    // deleteTokenAllowance

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

        it("rejects deleteTokenAllowance when allowances is empty", async () => {
            await expect(service.deleteTokenAllowance([])).rejects.toThrow(
                /tokenAllowances must be provided/,
            );
        });
    });

    // deleteNftAllowance

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

        it("rejects deleteNftAllowance when allowances is empty", async () => {
            await expect(service.deleteNftAllowance([])).rejects.toThrow(
                /nftAllowances must be provided/,
            );
        });

        it("rejects deleteNftAllowance when tokenId is missing", async () => {
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

        it("rejects deleteNftAllowance when ownerAccountId is missing", async () => {
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

        it("rejects deleteNftAllowance when serialNumbers is empty", async () => {
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

        it("rejects deleteNftAllowance with invalid serial numbers", async () => {
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

    // deleteAllTokenNftAllowances (approve-for-all-serials revocation)

    describe("deleteAllTokenNftAllowances", () => {
        it("revokes approve-for-all-serials with correct SDK arguments", async () => {
            await service.deleteAllTokenNftAllowances([
                {
                    tokenId: "0.0.600",
                    ownerAccountId: "0.0.100",
                    spenderAccountId: "0.0.200",
                },
            ]);

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.deleteTokenNftAllowanceAllSerials).toHaveBeenCalledTimes(
                1,
            );
            expect(tx.deleteTokenNftAllowanceAllSerials).toHaveBeenCalledWith(
                TokenId.fromString("0.0.600"),
                "0.0.100",
                "0.0.200",
            );
        });

        it("handles multiple approve-for-all-serials revocations", async () => {
            await service.deleteAllTokenNftAllowances([
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

            const tx = vi.mocked(AccountAllowanceApproveTransaction).mock
                .results[0].value;
            expect(tx.deleteTokenNftAllowanceAllSerials).toHaveBeenCalledTimes(
                2,
            );
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
            await service.deleteAllTokenNftAllowances(
                [
                    {
                        tokenId: "0.0.600",
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

        it("rejects deleteAllTokenNftAllowances when allowances is empty", async () => {
            await expect(
                service.deleteAllTokenNftAllowances([]),
            ).rejects.toThrow(/nftAllowances must be provided/);
        });

        it("rejects deleteAllTokenNftAllowances when tokenId is missing", async () => {
            await expect(
                service.deleteAllTokenNftAllowances([
                    {
                        tokenId: "",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "0.0.200",
                    },
                ]),
            ).rejects.toThrow(/tokenId is required/);
        });

        it("rejects deleteAllTokenNftAllowances when ownerAccountId is missing", async () => {
            await expect(
                service.deleteAllTokenNftAllowances([
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "",
                        spenderAccountId: "0.0.200",
                    },
                ]),
            ).rejects.toThrow(/ownerAccountId is required/);
        });

        it("rejects deleteAllTokenNftAllowances when spenderAccountId is missing", async () => {
            await expect(
                service.deleteAllTokenNftAllowances([
                    {
                        tokenId: "0.0.600",
                        ownerAccountId: "0.0.100",
                        spenderAccountId: "",
                    },
                ]),
            ).rejects.toThrow(/spenderAccountId is required/);
        });
    });
});
