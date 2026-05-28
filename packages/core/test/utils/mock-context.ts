import { vi } from "vitest";
import type { IHieroContext } from "../../src/context/index.js";

/**
 * Creates a mock HieroContext for unit testing service clients.
 * Satisfies the IHieroContext interface without needing the real SDK.
 *
 * Also includes `addTransactionListener` and `removeTransactionListener`
 * stubs so the listener tests can wire up behaviour on this mock.
 */
export function createMockContext(): IHieroContext & {
    addTransactionListener: ReturnType<typeof vi.fn>;
    removeTransactionListener: ReturnType<typeof vi.fn>;
} {
    const mockPublicKey = { toString: () => "mock-public-key" };

    return {
        client: {
            setOperator: vi.fn(),
            close: vi.fn(),
        },
        operatorAccountId: { toString: () => "0.0.2" },
        operatorPublicKey: mockPublicKey,
        signTransaction: vi.fn().mockImplementation(async (tx) => tx),
        emitBeforeTransaction: vi.fn().mockResolvedValue(undefined),
        emitAfterTransaction: vi.fn().mockResolvedValue(undefined),
        addTransactionListener: vi.fn(),
        removeTransactionListener: vi.fn(),
    } as unknown as IHieroContext & {
        addTransactionListener: ReturnType<typeof vi.fn>;
        removeTransactionListener: ReturnType<typeof vi.fn>;
    };
}
