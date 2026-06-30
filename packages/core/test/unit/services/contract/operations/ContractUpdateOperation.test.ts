import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContractUpdateTransaction, PrivateKey } from "@hiero-ledger/sdk";
import { ContractService } from "../../../../../src/services/contract/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle([
        "setContractId",
        "setAdminKey",
        "setContractMemo",
        "setAutoRenewPeriod",
        "setAutoRenewAccountId",
        "setExpirationTime",
        "setBytecodeFileId",
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
        ContractUpdateTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("ContractUpdateOperation (via ContractService)", () => {
    let context: IHieroContext;
    let service: ContractService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new ContractService(context);
    });

    describe("updateContract", () => {
        it("submits a ContractUpdateTransaction with only the contract ID when no other fields are set", async () => {
            const result = await service.updateContract({
                contractId: "0.0.12345",
            });

            expect(result).toBeUndefined();

            const tx = vi.mocked(ContractUpdateTransaction).mock.results[0]
                .value;
            expect(tx.setContractId).toHaveBeenCalledWith("0.0.12345");
            expect(tx.execute).toHaveBeenCalledWith(context.client);

            // No optional setters touched.
            expect(tx.setAdminKey).not.toHaveBeenCalled();
            expect(tx.setContractMemo).not.toHaveBeenCalled();
            expect(tx.setAutoRenewPeriod).not.toHaveBeenCalled();
            expect(tx.setAutoRenewAccountId).not.toHaveBeenCalled();
            expect(tx.setExpirationTime).not.toHaveBeenCalled();
            expect(tx.setBytecodeFileId).not.toHaveBeenCalled();
            expect(tx.setStakedAccountId).not.toHaveBeenCalled();
            expect(tx.setStakedNodeId).not.toHaveBeenCalled();
            expect(tx.setDeclineStakingReward).not.toHaveBeenCalled();
            expect(tx.setMaxAutomaticTokenAssociations).not.toHaveBeenCalled();
        });

        it("forwards every optional setter when the field is provided", async () => {
            const adminKey = PrivateKey.generateED25519().publicKey;
            const expirationTime = new Date(Date.now() + 7 * 86400 * 1000);

            await service.updateContract({
                contractId: "0.0.12345",
                adminKey,
                contractMemo: "renamed",
                autoRenewPeriod: 7_776_000,
                autoRenewAccountId: "0.0.123",
                expirationTime,
                bytecodeFileId: "0.0.555",
                stakedNodeId: 0,
                declineStakingReward: true,
                maxAutomaticTokenAssociations: 5,
            });

            const tx = vi.mocked(ContractUpdateTransaction).mock.results[0]
                .value;
            expect(tx.setAdminKey).toHaveBeenCalledWith(adminKey);
            expect(tx.setContractMemo).toHaveBeenCalledWith("renamed");
            expect(tx.setAutoRenewPeriod).toHaveBeenCalledWith(7_776_000);
            expect(tx.setAutoRenewAccountId).toHaveBeenCalledWith("0.0.123");
            expect(tx.setExpirationTime).toHaveBeenCalledWith(expirationTime);
            expect(tx.setBytecodeFileId).toHaveBeenCalledWith("0.0.555");
            expect(tx.setStakedNodeId).toHaveBeenCalledWith(0);
            expect(tx.setDeclineStakingReward).toHaveBeenCalledWith(true);
            expect(tx.setMaxAutomaticTokenAssociations).toHaveBeenCalledWith(5);
        });

        it("forwards stakedAccountId when supplied (mutually exclusive with stakedNodeId)", async () => {
            await service.updateContract({
                contractId: "0.0.12345",
                stakedAccountId: "0.0.321",
            });

            const tx = vi.mocked(ContractUpdateTransaction).mock.results[0]
                .value;
            expect(tx.setStakedAccountId).toHaveBeenCalledWith("0.0.321");
            expect(tx.setStakedNodeId).not.toHaveBeenCalled();
        });

        it("applies base TransactionOptions to the transaction", async () => {
            await service.updateContract({
                contractId: "0.0.12345",
                transactionMemo: "base memo",
                transactionValidDuration: 90,
                regenerateTransactionId: false,
            });

            const tx = vi.mocked(ContractUpdateTransaction).mock.results[0]
                .value;
            expect(tx.setTransactionMemo).toHaveBeenCalledWith("base memo");
            expect(tx.setTransactionValidDuration).toHaveBeenCalledWith(90);
            expect(tx.setRegenerateTransactionId).toHaveBeenCalledWith(false);
        });

        it("freezes and signs with additionalSigners before execute", async () => {
            const adminKey = PrivateKey.generateED25519();

            await service.updateContract({
                contractId: "0.0.12345",
                contractMemo: "renamed",
                additionalSigners: [adminKey],
            });

            const tx = vi.mocked(ContractUpdateTransaction).mock.results[0]
                .value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(adminKey);
        });

        it("propagates validator errors before touching the SDK", async () => {
            await expect(
                service.updateContract(
                    {} as unknown as Parameters<
                        typeof service.updateContract
                    >[0],
                ),
            ).rejects.toThrow(/contractId is required/);

            expect(vi.mocked(ContractUpdateTransaction)).not.toHaveBeenCalled();
        });
    });

    describe("scheduleUpdateContract", () => {
        it("schedules a contract update and returns the scheduleId", async () => {
            const result = await service.scheduleUpdateContract({
                contractId: "0.0.12345",
                contractMemo: "scheduled rename",
            });

            expect(result.scheduleId).toBe("0.0.777");
            expect(result.transactionId).toBe("0.0.123@1234567890.000000000");

            const tx = vi.mocked(ContractUpdateTransaction).mock.results[0]
                .value;
            expect(tx.schedule).toHaveBeenCalled();
        });

        it("forwards schedule options to the scheduling transaction", async () => {
            await service.scheduleUpdateContract(
                {
                    contractId: "0.0.12345",
                    contractMemo: "scheduled rename",
                },
                {
                    payerAccountId: "0.0.999",
                    scheduleMemo: "update via multisig",
                },
            );

            expect(mocks.scheduleTx.setPayerAccountId).toHaveBeenCalled();
            expect(mocks.scheduleTx.setScheduleMemo).toHaveBeenCalledWith(
                "update via multisig",
            );
        });
    });
});
