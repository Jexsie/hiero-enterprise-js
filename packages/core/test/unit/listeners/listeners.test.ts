import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountService } from "../../../src/services/account/index.js";
import { createMockContext } from "../../utils/mock-context.js";
import type { IHieroContext } from "../../../src/context/index.js";
import type {
    TransactionListener,
    TransactionEvent,
} from "../../../src/listeners/index.js";
import { PrivateKey } from "@hiero-ledger/sdk";

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();

    const mockTx = {
        // AccountCreateTransaction setters
        setKeyWithoutAlias: vi.fn().mockReturnThis(),
        setInitialBalance: vi.fn().mockReturnThis(),
        setMaxAutomaticTokenAssociations: vi.fn().mockReturnThis(),
        setAccountMemo: vi.fn().mockReturnThis(),
        setAlias: vi.fn().mockReturnThis(),
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
        schedule: vi.fn(),
        execute: vi.fn().mockResolvedValue({
            transactionId: { toString: () => "0.0.123@1234567890.000000000" },
            getReceipt: vi.fn().mockResolvedValue({
                status: { toString: () => "SUCCESS" },
                accountId: { toString: () => "0.0.12345" },
            }),
        }),
    };

    return {
        ...actual,
        AccountCreateTransaction: vi.fn(function () {
            return mockTx;
        }),
    };
});

describe("Transaction Listeners", () => {
    let context: IHieroContext;
    let client: AccountService;
    const beforeEvents: TransactionEvent[] = [];
    const afterEvents: TransactionEvent[] = [];
    const testPubKey = PrivateKey.generateED25519().publicKey.toString();

    beforeEach(() => {
        vi.clearAllMocks();
        beforeEvents.length = 0;
        afterEvents.length = 0;

        context = createMockContext();
        // Wire up real listener behavior on the mock
        const listeners: TransactionListener[] = [];
        vi.mocked(context.addTransactionListener).mockImplementation((l) => {
            listeners.push(l);
        });
        vi.mocked(context.removeTransactionListener).mockImplementation((l) => {
            const idx = listeners.indexOf(l);
            if (idx !== -1) listeners.splice(idx, 1);
        });
        vi.mocked(context.emitBeforeTransaction).mockImplementation(
            async (event) => {
                for (const l of listeners) {
                    l.onBeforeTransaction?.(event);
                }
            },
        );
        vi.mocked(context.emitAfterTransaction).mockImplementation(
            async (event) => {
                for (const l of listeners) {
                    l.onAfterTransaction?.(event);
                }
            },
        );

        client = new AccountService(context);
    });

    it("registers and calls listener on successful transaction", async () => {
        const listener: TransactionListener = {
            onBeforeTransaction: (event) => beforeEvents.push(event),
            onAfterTransaction: (event) => afterEvents.push(event),
        };

        context.addTransactionListener(listener);
        await client.createAccount({ publicKey: testPubKey });

        expect(beforeEvents).toHaveLength(1);
        expect(beforeEvents[0].type).toBe("AccountCreate");
        expect(afterEvents).toHaveLength(1);
        expect(afterEvents[0].status).toBe("SUCCESS");
    });

    it("allows removing listeners", async () => {
        const listener: TransactionListener = {
            onBeforeTransaction: (event) => beforeEvents.push(event),
            onAfterTransaction: (event) => afterEvents.push(event),
        };

        context.addTransactionListener(listener);
        context.removeTransactionListener(listener);

        await client.createAccount({ publicKey: testPubKey });

        expect(beforeEvents).toHaveLength(0);
        expect(afterEvents).toHaveLength(0);
    });

    it("handles failing transactions and captures errors", async () => {
        // Override execute to throw
        const { AccountCreateTransaction } = await import("@hiero-ledger/sdk");
        vi.mocked(AccountCreateTransaction).mockImplementationOnce(function () {
            return {
                setKeyWithoutAlias: vi.fn().mockReturnThis(),
                setInitialBalance: vi.fn().mockReturnThis(),
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
                execute: vi.fn().mockRejectedValue(new Error("TX_FAILED")),
            };
        } as unknown as new () => InstanceType<
            typeof AccountCreateTransaction
        >);

        const listener: TransactionListener = {
            onBeforeTransaction: (event) => beforeEvents.push(event),
            onAfterTransaction: (event) => afterEvents.push(event),
        };
        context.addTransactionListener(listener);

        await expect(
            client.createAccount({ publicKey: testPubKey }),
        ).rejects.toThrow();

        expect(beforeEvents).toHaveLength(1);
        expect(afterEvents).toHaveLength(1);
        expect(afterEvents[0].error).toBeDefined();
    });
});
