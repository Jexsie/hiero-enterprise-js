import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContractDeleteTransaction, PrivateKey } from "@hiero-ledger/sdk";
import { ContractService } from "../../../../../src/services/contract/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle([
        "setContractId",
        "setTransferAccountId",
        "setTransferContractId",
    ]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        ContractDeleteTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("ContractDeleteOperation (via ContractService)", () => {
    let context: IHieroContext;
    let service: ContractService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new ContractService(context);
    });

    describe("deleteContract", () => {
        it("submits a ContractDeleteTransaction with transferAccountId", async () => {
            const result = await service.deleteContract({
                contractId: "0.0.12345",
                transferAccountId: "0.0.2",
            });

            expect(result).toBeUndefined();

            const tx = vi.mocked(ContractDeleteTransaction).mock.results[0]
                .value;
            expect(tx.setContractId).toHaveBeenCalledWith("0.0.12345");
            expect(tx.setTransferAccountId).toHaveBeenCalledWith("0.0.2");
            expect(tx.setTransferContractId).not.toHaveBeenCalled();
            expect(tx.execute).toHaveBeenCalledWith(context.client);
        });

        it("submits a ContractDeleteTransaction with transferContractId", async () => {
            await service.deleteContract({
                contractId: "0.0.12345",
                transferContractId: "0.0.999",
            });

            const tx = vi.mocked(ContractDeleteTransaction).mock.results[0]
                .value;
            expect(tx.setContractId).toHaveBeenCalledWith("0.0.12345");
            expect(tx.setTransferContractId).toHaveBeenCalledWith("0.0.999");
            expect(tx.setTransferAccountId).not.toHaveBeenCalled();
        });

        it("applies base TransactionOptions to the transaction", async () => {
            await service.deleteContract({
                contractId: "0.0.12345",
                transferAccountId: "0.0.2",
                transactionMemo: "base memo",
                transactionValidDuration: 90,
                regenerateTransactionId: false,
            });

            const tx = vi.mocked(ContractDeleteTransaction).mock.results[0]
                .value;
            expect(tx.setTransactionMemo).toHaveBeenCalledWith("base memo");
            expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(90);
            expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        });

        it("freezes and signs with additionalSigners before execute", async () => {
            const adminKey = PrivateKey.generateED25519();

            await service.deleteContract({
                contractId: "0.0.12345",
                transferAccountId: "0.0.2",
                additionalSigners: [adminKey],
            });

            const tx = vi.mocked(ContractDeleteTransaction).mock.results[0]
                .value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(adminKey);
        });

        it("propagates validator errors before touching the SDK", async () => {
            await expect(
                service.deleteContract(
                    {} as unknown as Parameters<
                        typeof service.deleteContract
                    >[0],
                ),
            ).rejects.toThrow(/contractId is required/);

            expect(vi.mocked(ContractDeleteTransaction)).not.toHaveBeenCalled();
        });

        it("rejects when no transfer target is provided", async () => {
            await expect(
                service.deleteContract({
                    contractId: "0.0.12345",
                }),
            ).rejects.toThrow(/transfer target is required/);

            expect(vi.mocked(ContractDeleteTransaction)).not.toHaveBeenCalled();
        });

        it("rejects when both transfer targets are provided", async () => {
            await expect(
                service.deleteContract({
                    contractId: "0.0.12345",
                    transferAccountId: "0.0.2",
                    transferContractId: "0.0.999",
                }),
            ).rejects.toThrow(/transferAccountId or transferContractId/);

            expect(vi.mocked(ContractDeleteTransaction)).not.toHaveBeenCalled();
        });
    });

    describe("scheduleDeleteContract", () => {
        it("schedules a contract delete and returns the scheduleId", async () => {
            const result = await service.scheduleDeleteContract({
                contractId: "0.0.12345",
                transferAccountId: "0.0.2",
            });

            expect(result.scheduleId).toBe("0.0.777");
            expect(result.transactionId).toBe("0.0.123@1234567890.000000000");

            const tx = vi.mocked(ContractDeleteTransaction).mock.results[0]
                .value;
            expect(tx.schedule).toHaveBeenCalled();
        });

        it("forwards schedule options to the scheduling transaction", async () => {
            await service.scheduleDeleteContract(
                {
                    contractId: "0.0.12345",
                    transferAccountId: "0.0.2",
                },
                {
                    payerAccountId: "0.0.999",
                    scheduleMemo: "delete via multisig",
                },
            );

            expect(mocks.scheduleTx.setPayerAccountId).toHaveBeenCalled();
            expect(mocks.scheduleTx.setScheduleMemo).toHaveBeenCalledWith(
                "delete via multisig",
            );
        });
    });
});
