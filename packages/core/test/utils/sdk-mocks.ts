import { vi } from "vitest";

/**
 * Shared SDK mocking utilities for service unit tests.
 *
 * Hiero SDK transaction classes share a large surface area through their
 * common `Transaction` base — `setMaxTransactionFee`, `setTransactionMemo`,
 * `setTransactionValidDuration`, `setRegenerateTransactionId`, `setHighVolume`,
 * `setNodeAccountIds`, `_addSignatureLegacy`, `freezeWith`, `sign`, `signWith`,
 * `execute`, and `schedule`. Re-creating that shape in every test file is
 * noisy and drifts over time. The helpers below centralise the shape so each
 * service test only declares the methods that are *unique* to its operation.
 *
 * ## Why dynamic import inside `vi.hoisted`?
 *
 * `vi.mock` factories are hoisted above ESM imports, which means they cannot
 * reference statically-imported bindings. `vi.hoisted` solves that for inline
 * values, but its synchronous factory has the same constraint. Combining the
 * two — `await vi.hoisted(async () => { const m = await import(...); ... })`
 * — runs the dynamic import at hoist time, before the mocked module is
 * resolved, so the helper's output is available to the `vi.mock` factory.
 *
 * Top-level `await` in the test file is required (works in ESM modules,
 * which vitest uses for `.test.ts` files).
 */

type MockFn = ReturnType<typeof vi.fn>;

/**
 * The shape of a mocked Hiero SDK transaction. Common base-class methods are
 * typed explicitly; class-specific setters added via `extraMethods` show up as
 * additional string-keyed entries.
 */
export interface MockTransaction {
    // TransactionOptions setters (base `Transaction` class)
    setMaxTransactionFee: MockFn;
    setTransactionMemo: MockFn;
    setTransactionValidDuration: MockFn;
    setRegenerateTransactionId: MockFn;
    setHighVolume: MockFn;
    setNodeAccountIds: MockFn;
    // Offline signature application
    _addSignatureLegacy: MockFn;
    // Lifecycle
    freezeWith: MockFn;
    sign: MockFn;
    signWith: MockFn;
    execute: MockFn;
    schedule: MockFn;
    // Class-specific setters (e.g. `setKeyWithoutAlias`, `setTopicMemo`)
    [method: string]: MockFn;
}

/**
 * The schedule-side wrap of a mocked transaction. Carries the
 * `ScheduleCreateTransaction` setters that `TransactionExecutor.scheduleRun`
 * applies before delegating back to the standard `run()` lifecycle.
 */
export interface MockScheduleTransaction extends MockTransaction {
    setPayerAccountId: MockFn;
    setAdminKey: MockFn;
    setScheduleMemo: MockFn;
}

/**
 * Default receipt shape covering every entity ID the services return. Tests
 * read whichever fields are relevant for their operation; unused fields are
 * harmless.
 */
export interface MockReceipt {
    status: { toString(): string };
    accountId: { toString(): string };
    scheduleId: { toString(): string };
    topicId: { toString(): string };
    fileId: { toString(): string };
    contractId: { toString(): string };
    tokenId: { toString(): string };
}

export interface MockTransactionResponse {
    transactionId: { toString(): string };
    getReceipt: MockFn;
}

/**
 * A complete pre-wired bundle: `tx.execute()` resolves to `response`,
 * `response.getReceipt()` resolves to `receipt`, and `tx.schedule()` returns
 * `scheduleTx` (also pre-wired to `response`).
 */
export interface MockTxBundle {
    tx: MockTransaction;
    scheduleTx: MockScheduleTransaction;
    response: MockTransactionResponse;
    receipt: MockReceipt;
}

function buildBaseTransactionMethods(): MockTransaction {
    return {
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
        execute: vi.fn(),
        schedule: vi.fn(),
    };
}

/**
 * Build a fresh receipt with sensible defaults. All ID fields stringify to
 * predictable values so tests can assert `expect(x).toBe("0.0.999")` etc.
 */
export function buildMockReceipt(
    overrides: Partial<MockReceipt> = {},
): MockReceipt {
    return {
        status: { toString: () => "SUCCESS" },
        accountId: { toString: () => "0.0.999" },
        scheduleId: { toString: () => "0.0.777" },
        topicId: { toString: () => "0.0.888" },
        fileId: { toString: () => "0.0.555" },
        contractId: { toString: () => "0.0.666" },
        tokenId: { toString: () => "0.0.500" },
        ...overrides,
    };
}

/**
 * Build a fully-wired mock transaction bundle for use inside `vi.hoisted`.
 *
 * @param extraMethods - Names of class-specific chainable setters
 *   (e.g. `["setKeyWithoutAlias", "setInitialBalance"]`). Each is wired as
 *   `vi.fn().mockReturnThis()`.
 *
 * @example
 * ```ts
 * const mocks = await vi.hoisted(async () => {
 *     const { buildMockTxBundle } = await import("../../../utils/sdk-mocks.js");
 *     return buildMockTxBundle(["setAccountId", "setTransferAccountId"]);
 * });
 *
 * vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
 *     const actual = await importOriginal<Record<string, unknown>>();
 *     return {
 *         ...actual,
 *         AccountDeleteTransaction: vi.fn(function () {
 *             return mocks.tx;
 *         }),
 *     };
 * });
 *
 * beforeEach(() => {
 *     vi.clearAllMocks();
 *     reattachMockChain(mocks);
 * });
 * ```
 */
export function buildMockTxBundle(
    extraMethods: readonly string[] = [],
): MockTxBundle {
    const receipt = buildMockReceipt();
    const response: MockTransactionResponse = {
        transactionId: { toString: () => "0.0.123@1234567890.000000000" },
        getReceipt: vi.fn().mockResolvedValue(receipt),
    };

    const scheduleTx: MockScheduleTransaction = {
        ...buildBaseTransactionMethods(),
        setPayerAccountId: vi.fn().mockReturnThis(),
        setAdminKey: vi.fn().mockReturnThis(),
        setScheduleMemo: vi.fn().mockReturnThis(),
    };
    scheduleTx.execute.mockResolvedValue(response);

    const tx: MockTransaction = buildBaseTransactionMethods();
    tx.execute.mockResolvedValue(response);
    tx.schedule.mockReturnValue(scheduleTx);

    for (const method of extraMethods) {
        tx[method] = vi.fn().mockReturnThis();
    }

    return { tx, scheduleTx, response, receipt };
}

/**
 * Re-establish the `mockResolvedValue` / `mockReturnValue` chain that
 * `vi.clearAllMocks()` wipes. Call from `beforeEach` right after
 * `vi.clearAllMocks()`.
 */
export function reattachMockChain(bundle: MockTxBundle): void {
    bundle.response.getReceipt.mockResolvedValue(bundle.receipt);
    bundle.tx.execute.mockResolvedValue(bundle.response);
    bundle.tx.sign.mockResolvedValue(undefined);
    bundle.tx.schedule.mockReturnValue(bundle.scheduleTx);
    bundle.scheduleTx.execute.mockResolvedValue(bundle.response);
    bundle.scheduleTx.sign.mockResolvedValue(undefined);
}
