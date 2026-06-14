import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountDeleteTransaction, PrivateKey } from "@hiero-ledger/sdk";
import { AccountService } from "../../../../../src/services/account/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle(["setAccountId", "setTransferAccountId"]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        AccountDeleteTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("DeleteAccountOperation (via AccountService)", () => {
    let context: IHieroContext;
    let service: AccountService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
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

            expect(mocks.tx.schedule).toHaveBeenCalled();
            expect(result.scheduleId).toBe("0.0.777");
        });
    });
});
