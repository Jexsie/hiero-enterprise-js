import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountService } from "../../../src/services/account/index.js";
import { AccountType } from "../../../src/types/index.js";
import { createMockContext } from "../../utils/mock-context.js";
import type { IHieroContext } from "../../../src/context/index.js";
import {
    AccountCreateTransaction,
    AccountDeleteTransaction,
    AccountAllowanceApproveTransaction,
    PrivateKey,
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
        it("approves an HBAR allowance", async () => {
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
            expect(tx.approveHbarAllowance).toHaveBeenCalled();
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
        it("approves a fungible token allowance", async () => {
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
            expect(tx.approveTokenAllowance).toHaveBeenCalled();
        });
    });

    // approveNftAllowance

    describe("approveNftAllowance", () => {
        it("approves NFT allowance with specific serials", async () => {
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
        });

        it("approves NFT allowance for all serials", async () => {
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
            expect(tx.approveTokenNftAllowanceAllSerials).toHaveBeenCalled();
        });
    });

    // allowance validation

    describe("allowance validation", () => {
        it("rejects approveHbarAllowance when hbarAllowances is empty", () => {
            expect(() =>
                service.approveHbarAllowance({
                    hbarAllowances: [],
                }),
            ).toThrow(/hbarAllowances must be provided/);
        });

        it("rejects approveTokenAllowance when tokenAllowances is empty", () => {
            expect(() =>
                service.approveTokenAllowance({
                    tokenAllowances: [],
                }),
            ).toThrow(/tokenAllowances must be provided/);
        });

        it("rejects approveNftAllowance when nftAllowances is empty", () => {
            expect(() =>
                service.approveNftAllowance({
                    nftAllowances: [],
                }),
            ).toThrow(/nftAllowances must be provided/);
        });
    });
});
