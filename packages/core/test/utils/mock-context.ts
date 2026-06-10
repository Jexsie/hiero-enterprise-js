import { vi } from "vitest";
import type { IHieroContext } from "../../src/context/index.js";

/**
 * Creates a mock HieroContext for unit testing service clients.
 * Satisfies the IHieroContext interface without needing the real SDK.
 */
export function createMockContext(): IHieroContext {
    const mockPublicKey = { toString: () => "mock-public-key" };

    return {
        client: {
            setOperator: vi.fn(),
            close: vi.fn(),
        },
        operatorAccountId: { toString: () => "0.0.2" },
        operatorPublicKey: mockPublicKey,
        signTransaction: vi
            .fn()
            .mockImplementation((tx) => Promise.resolve(tx)),
        emitBeforeTransaction: vi.fn().mockResolvedValue(undefined),
        emitAfterTransaction: vi.fn().mockResolvedValue(undefined),
        addTransactionListener: vi.fn(),
        removeTransactionListener: vi.fn(),
    } as unknown as IHieroContext;
}
