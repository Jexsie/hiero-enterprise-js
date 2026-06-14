import { vi } from "vitest";

/**
 * Shared mock SDK fixtures for AccountService unit tests.
 *
 * Each operation test file builds its own mocks inline inside `vi.hoisted()`
 * (a vitest hoisting constraint — `vi.hoisted` factories can't reference
 * imported bindings since they run before imports resolve). The factories
 * below are used as **post-hoist** helpers from `beforeEach`, where they
 * re-establish resolved values that `vi.clearAllMocks()` wipes.
 */

/**
 * Re-establish the chained-promise behaviour on a mocked transaction +
 * response pair after `vi.clearAllMocks()` resets them.
 */
export function reattachMockChain(args: {
    tx: {
        execute: ReturnType<typeof vi.fn>;
        sign: ReturnType<typeof vi.fn>;
        schedule?: ReturnType<typeof vi.fn>;
    };
    response: { getReceipt: ReturnType<typeof vi.fn> };
    receipt: unknown;
    scheduleTx?: {
        execute: ReturnType<typeof vi.fn>;
        sign: ReturnType<typeof vi.fn>;
    };
}) {
    args.response.getReceipt.mockResolvedValue(args.receipt);
    args.tx.execute.mockResolvedValue(args.response);
    args.tx.sign.mockResolvedValue(undefined);
    if (args.scheduleTx && args.tx.schedule) {
        args.tx.schedule.mockReturnValue(args.scheduleTx);
        args.scheduleTx.execute.mockResolvedValue(args.response);
        args.scheduleTx.sign.mockResolvedValue(undefined);
    }
}
