import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScheduleService } from "../../../src/services/schedule/index.js";
import { createMockContext } from "../../utils/mock-context.js";
import type { IHieroContext } from "../../../src/context/index.js";
import {
    ScheduleSignTransaction,
    ScheduleDeleteTransaction,
    ScheduleInfoQuery,
    PrivateKey,
} from "@hiero-ledger/sdk";

// ─── Shared mock fixtures ───────────────────────────────────────────────────

const SCHEDULE_ID = "0.0.777";

const mockReceipt = {
    status: { toString: () => "SUCCESS" },
    scheduleId: { toString: () => SCHEDULE_ID },
};

const mockResponse = {
    transactionId: { toString: () => "0.0.2@1234567890.000000000" },
    getReceipt: vi.fn().mockResolvedValue(mockReceipt),
};

const mockScheduleInfoResult = {
    scheduleId: { toString: () => SCHEDULE_ID },
    creatorAccountId: { toString: () => "0.0.2" },
    payerAccountId: { toString: () => "0.0.2" },
    scheduleMemo: "pending approval",
    executed: null,
    deleted: null,
    expirationTime: {
        toDate: () => new Date("2099-01-01T00:00:00.000Z"),
    },
    scheduledTransactionId: { toString: () => "0.0.2@9999999999.000000000" },
    signers: { toArray: () => [] },
    waitForExpiry: false,
};

// Base transaction mock — returned by all mocked SDK transaction constructors
const mockTx = {
    setScheduleId: vi.fn().mockReturnThis(),
    // Base Transaction methods the executor may call
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

const mockInfoQuery = {
    setScheduleId: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(mockScheduleInfoResult),
};

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        ScheduleSignTransaction: vi.fn(function () {
            return mockTx;
        }),
        ScheduleDeleteTransaction: vi.fn(function () {
            return mockTx;
        }),
        ScheduleInfoQuery: vi.fn(function () {
            return mockInfoQuery;
        }),
    };
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("ScheduleService", () => {
    let context: IHieroContext;
    let scheduleService: ScheduleService;

    beforeEach(() => {
        vi.clearAllMocks();
        // Restore resolved values that clearAllMocks resets
        mockResponse.getReceipt.mockResolvedValue(mockReceipt);
        mockTx.execute.mockResolvedValue(mockResponse);
        mockTx.sign.mockResolvedValue(undefined);
        mockInfoQuery.execute.mockResolvedValue(mockScheduleInfoResult);

        context = createMockContext();
        scheduleService = new ScheduleService(context);
    });

    // ── sign() ───────────────────────────────────────────────────────────────

    describe("sign", () => {
        it("creates a ScheduleSignTransaction with the correct scheduleId", async () => {
            await scheduleService.sign({
                scheduleId: SCHEDULE_ID,
                additionalSigners: [PrivateKey.generateED25519()],
            });

            const tx = vi.mocked(ScheduleSignTransaction).mock.results[0].value;
            expect(tx.setScheduleId).toHaveBeenCalledWith(SCHEDULE_ID);
            expect(tx.execute).toHaveBeenCalledWith(context.client);
        });

        it("freezes and signs with additionalSigners before execute", async () => {
            const signerKey = PrivateKey.generateED25519();

            await scheduleService.sign({
                scheduleId: SCHEDULE_ID,
                additionalSigners: [signerKey],
            });

            const tx = vi.mocked(ScheduleSignTransaction).mock.results[0].value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.sign).toHaveBeenCalledWith(signerKey);
        });

        it("supports external (HSM/KMS) signers", async () => {
            const walletKey = PrivateKey.generateECDSA();
            const externalSigner = {
                publicKey: walletKey.publicKey,
                sign: async (msg: Uint8Array): Promise<Uint8Array> =>
                    walletKey.sign(msg),
            };

            await scheduleService.sign({
                scheduleId: SCHEDULE_ID,
                externalSigners: [externalSigner],
            });

            const tx = vi.mocked(ScheduleSignTransaction).mock.results[0].value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            expect(tx.signWith).toHaveBeenCalledWith(
                externalSigner.publicKey,
                externalSigner.sign,
            );
        });

        it("applies base TransactionOptions to the transaction", async () => {
            await scheduleService.sign({
                scheduleId: SCHEDULE_ID,
                transactionMemo: "multisig round 2",
                maxTransactionFee: 2,
            });

            const tx = vi.mocked(ScheduleSignTransaction).mock.results[0].value;
            expect(tx.setTransactionMemo).toHaveBeenCalledWith(
                "multisig round 2",
            );
            expect(tx.setMaxTransactionFee).toHaveBeenCalledWith(2);
        });

        it("emits before and after transaction events", async () => {
            await scheduleService.sign({ scheduleId: SCHEDULE_ID });

            expect(context.emitBeforeTransaction).toHaveBeenCalledOnce();
            expect(context.emitAfterTransaction).toHaveBeenCalledOnce();

            const afterArg = vi.mocked(context.emitAfterTransaction).mock
                .calls[0][0];
            expect(afterArg.type).toBe("ScheduleSign");
            expect(afterArg.status).toBe("SUCCESS");
        });
    });

    // ── cancel() ─────────────────────────────────────────────────────────────

    describe("cancel", () => {
        it("creates a ScheduleDeleteTransaction with the correct scheduleId", async () => {
            const adminKey = PrivateKey.generateED25519();

            await scheduleService.cancel({ scheduleId: SCHEDULE_ID, adminKey });

            const tx = vi.mocked(ScheduleDeleteTransaction).mock.results[0]
                .value;
            expect(tx.setScheduleId).toHaveBeenCalledWith(SCHEDULE_ID);
            expect(tx.execute).toHaveBeenCalledWith(context.client);
        });

        it("freezes and signs with adminKey as the first signer", async () => {
            const adminKey = PrivateKey.generateED25519();

            await scheduleService.cancel({ scheduleId: SCHEDULE_ID, adminKey });

            const tx = vi.mocked(ScheduleDeleteTransaction).mock.results[0]
                .value;
            expect(tx.freezeWith).toHaveBeenCalledWith(context.client);
            // adminKey should be the first (and only) signer
            expect(tx.sign).toHaveBeenCalledWith(adminKey);
        });

        it("places adminKey before any additional signers", async () => {
            const adminKey = PrivateKey.generateED25519();
            const extraKey = PrivateKey.generateED25519();

            await scheduleService.cancel({
                scheduleId: SCHEDULE_ID,
                adminKey,
                additionalSigners: [extraKey],
            });

            const tx = vi.mocked(ScheduleDeleteTransaction).mock.results[0]
                .value;
            const calls = vi.mocked(tx.sign).mock.calls;
            // adminKey signs first, extraKey signs second
            expect(calls[0][0]).toBe(adminKey);
            expect(calls[1][0]).toBe(extraKey);
        });

        it("emits before and after transaction events", async () => {
            const adminKey = PrivateKey.generateED25519();

            await scheduleService.cancel({ scheduleId: SCHEDULE_ID, adminKey });

            const afterArg = vi.mocked(context.emitAfterTransaction).mock
                .calls[0][0];
            expect(afterArg.type).toBe("ScheduleDelete");
            expect(afterArg.status).toBe("SUCCESS");
        });
    });

    // ── getInfo() ────────────────────────────────────────────────────────────

    describe("getInfo", () => {
        it("returns structured schedule info for a pending schedule", async () => {
            const info = await scheduleService.getInfo(SCHEDULE_ID);

            const query = vi.mocked(ScheduleInfoQuery).mock.results[0].value;
            expect(query.setScheduleId).toHaveBeenCalledWith(SCHEDULE_ID);
            expect(query.execute).toHaveBeenCalledWith(context.client);

            expect(info.scheduleId).toBe(SCHEDULE_ID);
            expect(info.scheduleMemo).toBe("pending approval");
            expect(info.creatorAccountId).toBe("0.0.2");
            expect(info.isPending).toBe(true);
            expect(info.isExecuted).toBe(false);
            expect(info.isDeleted).toBe(false);
            expect(info.signerCount).toBe(0);
            expect(info.waitForExpiry).toBe(false);
            expect(info.expiresAt).toBe("2099-01-01T00:00:00.000Z");
        });

        it("reflects executed state correctly", async () => {
            const executedAt = new Date("2025-06-01T12:00:00.000Z");
            mockInfoQuery.execute.mockResolvedValueOnce({
                ...mockScheduleInfoResult,
                executed: { toDate: () => executedAt },
            });

            const info = await scheduleService.getInfo(SCHEDULE_ID);

            expect(info.isExecuted).toBe(true);
            expect(info.isPending).toBe(false);
            expect(info.executedAt).toBe("2025-06-01T12:00:00.000Z");
        });

        it("reflects deleted state correctly", async () => {
            const deletedAt = new Date("2025-06-01T14:00:00.000Z");
            mockInfoQuery.execute.mockResolvedValueOnce({
                ...mockScheduleInfoResult,
                deleted: { toDate: () => deletedAt },
            });

            const info = await scheduleService.getInfo(SCHEDULE_ID);

            expect(info.isDeleted).toBe(true);
            expect(info.isPending).toBe(false);
            expect(info.deletedAt).toBe("2025-06-01T14:00:00.000Z");
        });

        it("counts signers from the KeyList", async () => {
            mockInfoQuery.execute.mockResolvedValueOnce({
                ...mockScheduleInfoResult,
                signers: {
                    toArray: () => [
                        { toString: () => "key-1" },
                        { toString: () => "key-2" },
                    ],
                },
            });

            const info = await scheduleService.getInfo(SCHEDULE_ID);

            expect(info.signerCount).toBe(2);
        });

        it("wraps errors in a HieroError", async () => {
            mockInfoQuery.execute.mockRejectedValueOnce(
                new Error("INVALID_SCHEDULE_ID"),
            );

            await expect(
                scheduleService.getInfo("0.0.invalid"),
            ).rejects.toMatchObject({
                name: "HieroError",
                context: "ScheduleService.getInfo",
            });
        });
    });
});
