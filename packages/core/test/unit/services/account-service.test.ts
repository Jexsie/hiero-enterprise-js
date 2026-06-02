import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountService } from "../../../src/services/account-service.js";
import { createMockContext } from "../../utils/mock-context.js";
import type { IHieroContext } from "../../../src/context/index.js";
import {
    AccountCreateTransaction,
    AccountDeleteTransaction,
    PrivateKey,
} from "@hiero-ledger/sdk";

// Mock the SDK
vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();

    const mockTx = {
        setKeyWithoutAlias: vi.fn().mockReturnThis(),
        setInitialBalance: vi.fn().mockReturnThis(),
        setMaxAutomaticTokenAssociations: vi.fn().mockReturnThis(),
        setAccountMemo: vi.fn().mockReturnThis(),
        setAccountId: vi.fn().mockReturnThis(),
        setTransferAccountId: vi.fn().mockReturnThis(),
        setAlias: vi.fn().mockReturnThis(),
        addHbarTransfer: vi.fn().mockReturnThis(),
        freezeWith: vi.fn().mockReturnThis(),
        sign: vi.fn().mockResolvedValue({
            execute: vi.fn().mockResolvedValue({
                transactionId: {
                    toString: () => "0.0.123@1234567890.000000000",
                },
                getReceipt: vi.fn().mockResolvedValue({
                    status: { toString: () => "SUCCESS" },
                    accountId: { toString: () => "0.0.999" },
                }),
            }),
        }),
        execute: vi.fn().mockResolvedValue({
            transactionId: { toString: () => "0.0.123@1234567890.000000000" },
            getReceipt: vi.fn().mockResolvedValue({
                status: { toString: () => "SUCCESS" },
                accountId: { toString: () => "0.0.999" },
            }),
        }),
    };

    const mockQuery = {
        setAccountId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({
            hbars: {
                toTinybars: () => ({ toString: () => "1000000" }),
            },
            tokens: null,
            tokenDecimals: null,
        }),
    };

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
    };
});

describe("AccountService", () => {
    let context: IHieroContext;
    let client: AccountService;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createMockContext();
        client = new AccountService(context);
    });

    describe("createAccount", () => {
        it("creates an account with default options (Hiero native ED25519)", async () => {
            const account = await client.createAccount();

            expect(account.accountId.toString()).toBe("0.0.999");
            expect(account.publicKey).toBeDefined();
            expect(account.privateKey).toBeDefined();
            expect(account.evmAddress).toBeUndefined();

            const mockInstance = vi.mocked(AccountCreateTransaction).mock
                .results[0].value;
            expect(mockInstance.setInitialBalance).toHaveBeenCalled();
            expect(mockInstance.setKeyWithoutAlias).toHaveBeenCalled();
            expect(mockInstance.setAlias).not.toHaveBeenCalled();
            expect(mockInstance.execute).toHaveBeenCalledWith(context.client);
        });

        it("creates an account with custom options and EVM type", async () => {
            const account = await client.createAccount({
                initialBalance: 5,
                maxAutomaticTokenAssociations: 10,
                memo: "test memo",
                evm: true,
            });

            expect(account.accountId.toString()).toBe("0.0.999");
            // evmAddress depends on PrivateKey.generateECDSA().publicKey.toEvmAddress()
            // which is mocked; we just verify setAlias was called

            const mockInstance = vi.mocked(AccountCreateTransaction).mock
                .results[0].value;
            expect(mockInstance.setInitialBalance).toHaveBeenCalled();
            expect(
                mockInstance.setMaxAutomaticTokenAssociations,
            ).toHaveBeenCalledWith(10);
            expect(mockInstance.setAccountMemo).toHaveBeenCalledWith(
                "test memo",
            );
            expect(mockInstance.setAlias).toHaveBeenCalled();
        });
    });

    describe("deleteAccount", () => {
        it("deletes an account transferring to operator by default", async () => {
            const mockKey = PrivateKey.generateED25519();
            await client.deleteAccount("0.0.999", mockKey);

            const mockInstance = vi.mocked(AccountDeleteTransaction).mock
                .results[0].value;
            expect(mockInstance.setAccountId).toHaveBeenCalledWith("0.0.999");
            expect(mockInstance.setTransferAccountId).toHaveBeenCalledWith(
                "0.0.2",
            );
        });

        it("deletes an account with custom transfer target", async () => {
            const mockKey = PrivateKey.generateED25519();
            await client.deleteAccount("0.0.999", mockKey, "0.0.555");

            const mockInstance = vi.mocked(AccountDeleteTransaction).mock
                .results[0].value;
            expect(mockInstance.setTransferAccountId).toHaveBeenCalledWith(
                "0.0.555",
            );
        });
    });

    describe("getAccountBalance", () => {
        it("fetches the account balance", async () => {
            const balance = await client.getAccountBalance("0.0.999");

            expect(balance.accountId).toBe("0.0.999");
            expect(balance.hbars).toBe("1000000");
            expect(balance.tokens).toEqual([]);
        });
    });

    describe("getOperatorAccountBalance", () => {
        it("fetches the operator balance", async () => {
            const balance = await client.getOperatorAccountBalance();

            expect(balance.accountId).toBe("0.0.2");
            expect(balance.hbars).toBe("1000000");
        });
    });
});
