import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    ContractCreateTransaction,
    PrivateKey,
    FileId,
} from "@hiero-ledger/sdk";
import { ContractService } from "../../../../../src/services/contract/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle([
        "setBytecodeFileId",
        "setBytecode",
        "setGas",
        "setInitialBalance",
        "setAdminKey",
        "setConstructorParameters",
        "setContractMemo",
        "setAutoRenewPeriod",
        "setAutoRenewAccountId",
        "setStakedAccountId",
        "setStakedNodeId",
        "setDeclineStakingReward",
        "setMaxAutomaticTokenAssociations",
    ]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        ContractCreateTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("ContractCreateOperation (via ContractService)", () => {
    let context: IHieroContext;
    let service: ContractService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new ContractService(context);
    });

    describe("createContract", () => {
        it("creates a contract from a bytecode FileId and returns the contract ID", async () => {
            const contractId = await service.createContract({
                bytecodeFileId: "0.0.555",
                gas: 100_000,
            });

            expect(contractId).toBe("0.0.666");

            const tx = vi.mocked(ContractCreateTransaction).mock.results[0]
                .value;
            expect(tx.setBytecodeFileId).toHaveBeenCalledWith("0.0.555");
            expect(tx.setGas).toHaveBeenCalledWith(100_000);
            expect(tx.execute).toHaveBeenCalledWith(context.client);
        });

        it("accepts a FileId instance", async () => {
            const fileId = FileId.fromString("0.0.555");

            await service.createContract({
                bytecodeFileId: fileId,
                gas: 100_000,
            });

            const tx = vi.mocked(ContractCreateTransaction).mock.results[0]
                .value;
            expect(tx.setBytecodeFileId).toHaveBeenCalledWith(fileId);
        });

        it("creates a contract from raw bytecode bytes (HIP-435)", async () => {
            const bytecode = new Uint8Array([0x60, 0x80, 0x60, 0x40]);

            const contractId = await service.createContract({
                bytecode,
                gas: 200_000,
            });

            expect(contractId).toBe("0.0.666");

            const tx = vi.mocked(ContractCreateTransaction).mock.results[0]
                .value;
            expect(tx.setBytecode).toHaveBeenCalledWith(bytecode);
            expect(tx.setGas).toHaveBeenCalledWith(200_000);
        });

        it("forwards every optional setter when the field is provided", async () => {
            const adminKey = PrivateKey.generateED25519().publicKey;
            const constructorParameters = new Uint8Array([1, 2, 3]);

            await service.createContract({
                bytecodeFileId: "0.0.555",
                gas: 100_000,
                initialBalance: 10,
                adminKey,
                constructorParameters,
                contractMemo: "demo",
                autoRenewPeriod: 7_776_000,
                autoRenewAccountId: "0.0.123",
                stakedNodeId: 0,
                declineStakingReward: true,
                maxAutomaticTokenAssociations: 5,
            });

            const tx = vi.mocked(ContractCreateTransaction).mock.results[0]
                .value;
            expect(tx.setInitialBalance).toHaveBeenCalledWith(10);
            expect(tx.setAdminKey).toHaveBeenCalledWith(adminKey);
            expect(tx.setConstructorParameters).toHaveBeenCalledWith(
                constructorParameters,
            );
            expect(tx.setContractMemo).toHaveBeenCalledWith("demo");
            expect(tx.setAutoRenewPeriod).toHaveBeenCalledWith(7_776_000);
            expect(tx.setAutoRenewAccountId).toHaveBeenCalledWith("0.0.123");
            expect(tx.setStakedNodeId).toHaveBeenCalledWith(0);
            expect(tx.setDeclineStakingReward).toHaveBeenCalledWith(true);
            expect(tx.setMaxAutomaticTokenAssociations).toHaveBeenCalledWith(5);
        });

        it("does not call optional setters when fields are omitted", async () => {
            await service.createContract({
                bytecodeFileId: "0.0.555",
                gas: 100_000,
            });

            const tx = vi.mocked(ContractCreateTransaction).mock.results[0]
                .value;
            expect(tx.setBytecode).not.toHaveBeenCalled();
            expect(tx.setInitialBalance).not.toHaveBeenCalled();
            expect(tx.setAdminKey).not.toHaveBeenCalled();
            expect(tx.setConstructorParameters).not.toHaveBeenCalled();
            expect(tx.setContractMemo).not.toHaveBeenCalled();
            expect(tx.setAutoRenewPeriod).not.toHaveBeenCalled();
            expect(tx.setAutoRenewAccountId).not.toHaveBeenCalled();
            expect(tx.setStakedAccountId).not.toHaveBeenCalled();
            expect(tx.setStakedNodeId).not.toHaveBeenCalled();
            expect(tx.setDeclineStakingReward).not.toHaveBeenCalled();
            expect(tx.setMaxAutomaticTokenAssociations).not.toHaveBeenCalled();
        });

        it("applies base TransactionOptions to the transaction", async () => {
            await service.createContract({
                bytecodeFileId: "0.0.555",
                gas: 100_000,
                transactionMemo: "base memo",
                transactionValidDuration: 90,
                regenerateTransactionId: false,
            });

            const tx = vi.mocked(ContractCreateTransaction).mock.results[0]
                .value;
            expect(tx.setTransactionMemo).toHaveBeenCalledWith("base memo");
            expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(90);
            expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        });

        it("freezes and signs with additionalSigners before execute", async () => {
            const adminKey = PrivateKey.generateED25519();

            await service.createContract({
                bytecodeFileId: "0.0.555",
                gas: 100_000,
                additionalSigners: [adminKey],
            });

            const tx = vi.mocked(ContractCreateTransaction).mock.results[0]
                .value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(adminKey);
        });

        it("propagates validator errors before touching the SDK", async () => {
            await expect(
                service.createContract({
                    gas: 100_000,
                } as unknown as Parameters<typeof service.createContract>[0]),
            ).rejects.toThrow(/bytecodeFileId or bytecode/);

            expect(vi.mocked(ContractCreateTransaction)).not.toHaveBeenCalled();
        });
    });

    describe("scheduleCreateContract", () => {
        it("schedules a contract creation and returns the scheduleId", async () => {
            const result = await service.scheduleCreateContract({
                bytecodeFileId: "0.0.555",
                gas: 100_000,
            });

            expect(result.scheduleId).toBe("0.0.777");
            expect(result.transactionId).toBe("0.0.123@1234567890.000000000");

            const tx = vi.mocked(ContractCreateTransaction).mock.results[0]
                .value;
            expect(tx.schedule).toHaveBeenCalled();
        });

        it("forwards schedule options to the scheduling transaction", async () => {
            await service.scheduleCreateContract(
                {
                    bytecodeFileId: "0.0.555",
                    gas: 100_000,
                },
                {
                    payerAccountId: "0.0.999",
                    scheduleMemo: "deploy via multisig",
                },
            );

            expect(mocks.scheduleTx.setPayerAccountId).toHaveBeenCalled();
            expect(mocks.scheduleTx.setScheduleMemo).toHaveBeenCalledWith(
                "deploy via multisig",
            );
        });
    });
});
