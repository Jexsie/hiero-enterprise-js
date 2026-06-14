import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountCreateTransaction, PrivateKey } from "@hiero-ledger/sdk";
import { AccountService } from "../../../../../src/services/account/index.js";
import { AccountType } from "../../../../../src/types/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle([
        "setKeyWithoutAlias",
        "setECDSAKeyWithAlias",
        "setKeyWithAlias",
        "setInitialBalance",
        "setMaxAutomaticTokenAssociations",
        "setAccountMemo",
        "setReceiverSignatureRequired",
        "setStakedAccountId",
        "setStakedNodeId",
        "setDeclineStakingReward",
    ]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        AccountCreateTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("CreateAccountOperation (via AccountService)", () => {
    let context: IHieroContext;
    let service: AccountService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new AccountService(context);
    });

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

    describe("scheduleCreateAccount", () => {
        it("wraps the transaction in a ScheduleCreateTransaction", async () => {
            const pubKey = PrivateKey.generateED25519().publicKey.toString();
            const result = await service.scheduleCreateAccount(
                { publicKey: pubKey },
                { scheduleMemo: "pending approval" },
            );

            expect(mocks.tx.schedule).toHaveBeenCalled();
            expect(mocks.scheduleTx.setScheduleMemo).toHaveBeenCalledWith(
                "pending approval",
            );
            expect(result.scheduleId).toBe("0.0.777");
            expect(result.transactionId).toBeDefined();
        });
    });
});
