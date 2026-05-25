import { vi } from "vitest";
import type { HieroContext } from "../../src/context/hiero-context.js";

/**
 * Creates a mock HieroContext for unit testing service clients.
 * This avoids needing to construct a real HieroContext (which requires SDK mocking).
 */
export function createMockContext(): HieroContext {
    const mockPublicKey = { toString: () => "mock-public-key" };
    const mockOperatorKey = {
        toString: () => "mock-private-key",
        publicKey: mockPublicKey,
    };

    return {
        client: {
            setOperator: vi.fn(),
            close: vi.fn(),
        },
        config: {
            network: "testnet",
            operatorId: "0.0.2",
            operatorKey:
                "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208",
        },
        operatorAccountId: { toString: () => "0.0.2" },
        operatorPublicKey: mockPublicKey,
        getOperatorKey: vi.fn().mockReturnValue(mockOperatorKey),
        signTransaction: vi.fn().mockImplementation(async (tx) => tx),
        close: vi.fn(),
        addTransactionListener: vi.fn(),
        removeTransactionListener: vi.fn(),
        emitBeforeTransaction: vi.fn().mockResolvedValue(undefined),
        emitAfterTransaction: vi.fn().mockResolvedValue(undefined),
    } as unknown as HieroContext;
}
