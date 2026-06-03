import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountService } from "../../../src/services/account-service.js";
import { AccountType } from "../../../src/types/index.js";
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
        setECDSAKeyWithAlias: vi.fn().mockReturnThis(),
        setKeyWithAlias: vi.fn().mockReturnThis(),
        setInitialBalance: vi.fn().mockReturnThis(),
        setMaxAutomaticTokenAssociations: vi.fn().mockReturnThis(),
        setAccountMemo: vi.fn().mockReturnThis(),
        setAccountId: vi.fn().mockReturnThis(),
        setTransferAccountId: vi.fn().mockReturnThis(),
        setReceiverSignatureRequired: vi.fn().mockReturnThis(),
        setStakedAccountId: vi.fn().mockReturnThis(),
        setStakedNodeId: vi.fn().mockReturnThis(),
        setDeclineStakingReward: vi.fn().mockReturnThis(),
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
        it("creates an account with an ED25519 public key (default keyType)", async () => {
            const pubKey = PrivateKey.generateED25519().publicKey.toString();
            const account = await client.createAccount({ publicKey: pubKey });

            expect(account.accountId).toBe("0.0.999");
            expect(account.publicKey).toBeDefined();
            expect(account.evmAddress).toBeUndefined();

            const mockInstance = vi.mocked(AccountCreateTransaction).mock
                .results[0].value;
            expect(mockInstance.setKeyWithoutAlias).toHaveBeenCalled();
            expect(mockInstance.setInitialBalance).toHaveBeenCalled();
            expect(mockInstance.execute).toHaveBeenCalledWith(context.client);
        });

        it("creates an ECDSA account with alias derived from the key", async () => {
            const pubKey = PrivateKey.generateECDSA().publicKey.toString();
            const account = await client.createAccount({
                publicKey: pubKey,
                keyType: AccountType.ECDSA,
                alias: true,
                initialBalance: 5,
            });

            expect(account.accountId).toBe("0.0.999");

            const mockInstance = vi.mocked(AccountCreateTransaction).mock
                .results[0].value;
            expect(mockInstance.setECDSAKeyWithAlias).toHaveBeenCalled();
            expect(mockInstance.setKeyWithoutAlias).not.toHaveBeenCalled();
        });

        it("creates an account with a separate alias key (two-key pattern)", async () => {
            const primaryKey =
                PrivateKey.generateED25519().publicKey.toString();
            const aliasKey = PrivateKey.generateECDSA().publicKey.toString();

            await client.createAccount({
                publicKey: primaryKey,
                keyType: AccountType.ED25519,
                alias: { ecdsaPublicKey: aliasKey },
            });

            const mockInstance = vi.mocked(AccountCreateTransaction).mock
                .results[0].value;
            expect(mockInstance.setKeyWithAlias).toHaveBeenCalled();
            expect(mockInstance.setKeyWithoutAlias).not.toHaveBeenCalled();
            expect(mockInstance.setECDSAKeyWithAlias).not.toHaveBeenCalled();
        });

        it("throws if alias: true is used with an ED25519 key", async () => {
            const pubKey = PrivateKey.generateED25519().publicKey.toString();

            await expect(
                client.createAccount({
                    publicKey: pubKey,
                    keyType: AccountType.ED25519,
                    alias: true,
                }),
            ).rejects.toThrow(/requires keyType 'ECDSA'/);
        });

        it("sets all optional properties when provided", async () => {
            const pubKey = PrivateKey.generateED25519().publicKey.toString();
            await client.createAccount({
                publicKey: pubKey,
                initialBalance: 10,
                receiverSignatureRequired: true,
                memo: "test memo",
                maxAutomaticTokenAssociations: 5,
                stakedNodeId: 3,
                declineStakingReward: true,
            });

            const mockInstance = vi.mocked(AccountCreateTransaction).mock
                .results[0].value;
            expect(mockInstance.setInitialBalance).toHaveBeenCalled();
            expect(
                mockInstance.setReceiverSignatureRequired,
            ).toHaveBeenCalledWith(true);
            expect(mockInstance.setAccountMemo).toHaveBeenCalledWith(
                "test memo",
            );
            expect(
                mockInstance.setMaxAutomaticTokenAssociations,
            ).toHaveBeenCalledWith(5);
            expect(mockInstance.setStakedNodeId).toHaveBeenCalledWith(3);
            expect(mockInstance.setDeclineStakingReward).toHaveBeenCalledWith(
                true,
            );
        });

        it("sets stakedAccountId when provided", async () => {
            const pubKey = PrivateKey.generateED25519().publicKey.toString();
            await client.createAccount({
                publicKey: pubKey,
                stakedAccountId: "0.0.800",
            });

            const mockInstance = vi.mocked(AccountCreateTransaction).mock
                .results[0].value;
            expect(mockInstance.setStakedAccountId).toHaveBeenCalledWith(
                "0.0.800",
            );
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
