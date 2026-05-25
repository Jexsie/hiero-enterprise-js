# Issue Tracker — hiero-enterprise-node

All issues identified across the full codebase and SDK consistency review.
Priority: **P0** = release blocker, **P1** = enterprise credibility, **P2** = polish / nice-to-have.

---

## P0 — Release Blockers

### BUG-01: `getAccountBalance` accesses an `@internal` SDK field
**File:** `packages/core/src/services/account-client.ts:301`

`balance.tokens._map` is marked `@internal` in `ObjectMap.js` and is not part of the public SDK API. It may break on any SDK version bump.

```ts
// WRONG
[...balance.tokens._map.entries()].map(([tokenId, amount]) => ({
    tokenId: tokenId.toString(),
    balance: amount.toNumber(),
    decimals: 0,
}))

// CORRECT — public iterator + tokenDecimals map
const tokens = [];
for (const [tokenId, amount] of balance.tokens) {
    tokens.push({
        tokenId: tokenId.toString(),
        balance: amount.toString(),
        decimals: balance.tokenDecimals.get(tokenId) ?? 0,
    });
}
```

Two additional bugs piggyback on this:
- `amount.toNumber()` — `Long` values can overflow `number`; use `.toString()`.
- `decimals: 0` is hardcoded; the real value is in `balance.tokenDecimals` (a parallel `TokenDecimalMap`).

---

### BUG-02: `normalizeError` accesses `error.status._code` — an `@internal` SDK field
**File:** `packages/core/src/errors/hiero-error.ts`

`Status._code` is `@internal`. `Status.toString()` is the public API and returns the human-readable name (e.g. `"INSUFFICIENT_TX_FEE"`).

```ts
// WRONG
const sdkError = error as { status?: { _code?: number } };
const code = sdkError.status?._code?.toString() ?? "SDK_ERROR";

// CORRECT
const sdkError = error as { status?: { toString(): string } };
const code = sdkError.status?.toString() ?? "SDK_ERROR";
```

Additionally, `ReceiptStatusError` (thrown by `getReceipt()` on non-SUCCESS transactions) carries both a `.status` and a `.transactionId`. It should be detected and handled specifically so those fields are preserved in `HieroError`.

---

### BUG-03: `updateFile` does not chunk large file content
**File:** `packages/core/src/services/file-client.ts`

`createFile` correctly splits content into ≤4 KB chunks. `updateFile` sends the full content in a single `FileUpdateTransaction`, which silently fails or is rejected for files larger than the ~4 KB gRPC message limit.

Fix: apply the same chunking loop used in `createFile` to `updateFile`.

---

### BUG-04: `deleteAccount` emits `status: "SUCCESS"` without fetching a receipt
**File:** `packages/core/src/services/account-client.ts:267`

```ts
await this.context.emitAfterTransaction({
    ...event,
    transactionId: response.transactionId.toString(),
    status: "SUCCESS",  // hardcoded — receipt never fetched
    durationMs: Date.now() - start,
});
```

The transaction may have failed on-network. Call `response.getReceipt(this.context.client)` and use `receipt.status.toString()`.

---

### BUG-05: `autoCreateEvmAccount` uses `type: "TokenTransfer"` for an HBAR transfer
**File:** `packages/core/src/services/account-client.ts:200`

```ts
const event: TransactionEvent = {
    type: "TokenTransfer",  // wrong — this is a CryptoTransfer
    ...
};
```

Use `type: "HbarTransfer"` (or define a dedicated `"AccountAutoCreate"` event type).

---

### BUG-06: `Account.evmAddress` typed as `string | PublicKey` — EVM addresses are always strings
**File:** `packages/core/src/types/account.ts:26`

An EVM address is a `0x`-prefixed hex string. `PublicKey` is never a valid EVM address. Change to `evmAddress?: string`.

---

### SEC-01: `operatorKey` is a public field on `HieroContext`
**File:** `packages/core/src/context/hiero-context.ts`

```ts
public readonly operatorKey: PrivateKey;
```

Exposing the operator's private key as a public field makes it accessible to any code that holds a `HieroContext` reference — framework middleware, repositories, error serializers, loggers. Change to `private readonly #operatorKey` (or `private readonly _operatorKey`). If callers need to sign transactions, add a narrow signing helper (`signTransaction(tx)`).

---

### SEC-02: `createAccount` returns `privateKey` in the `Account` type
**File:** `packages/core/src/services/account-client.ts:82`, `packages/core/src/types/account.ts`

The base `Account` type carries `privateKey?: PrivateKey`. This field flows into every place an `Account` is used — JSON responses, logs, event payloads. Create a distinct `CreatedAccount` type returned only by `createAccount`, with a clear comment that the key must be stored securely and is not available again.

---

### ARCH-01: `HieroContext` is a process-level singleton — blocks multi-tenancy and test isolation
**File:** `packages/core/src/context/hiero-context.ts`

```ts
public static instance: HieroContext | null = null;
```

One process can only have one operator. `initialize()` silently returns the cached instance if called again with a different config. `reset()` tears down the global — a test calling reset affects all concurrent code. This is the most fundamental architectural constraint in the project.

Fix: Remove the static singleton. Make `HieroContext` a plain instantiatable class. Framework integrations (Express middleware, Fastify plugin, NestJS module) create and own a single instance scoped to the application lifecycle, not to the module.

---

### ARCH-02: NestJS module is not a real NestJS module
**File:** `packages/nest/src/index.ts`

- No `@Module` decorator (no `@nestjs/common` import at all)
- Hand-rolled `NestDynamicModule` interface that mimics the real one
- All providers use `useValue` with pre-constructed instances — NestJS DI lifecycle hooks (`OnModuleInit`, `OnModuleDestroy`) never fire
- No `forRootAsync()` — prevents config loading via `ConfigService`

This package will not work as a drop-in NestJS module. It needs to be rewritten using real `@nestjs/common` decorators and proper provider factories.

---

## P1 — Enterprise Credibility

### ARCH-03: `HieroServices` interface is duplicated between Express and Fastify packages
**Files:** `packages/express/src/index.ts`, `packages/fastify/src/index.ts`

Both define an identical 14-field `HieroServices` interface. Move it to `packages/core/src/types/` and re-export from both framework packages.

---

### ARCH-04: `createTopic` and `createPrivateTopic` share ~90% duplicated code
**File:** `packages/core/src/services/topic-client.ts`

Extract a private `_buildTopicTransaction(options)` helper. Both public methods call it with different key configurations.

---

### ARCH-05: `HieroConfig` does not expose SDK client retry/timeout settings
**File:** `packages/core/src/config/hiero-config.ts`

The SDK exposes `setRequestTimeout()`, `setGrpcDeadline()`, `setMaxAttempts()`, `setMinBackoff()`, `setMaxBackoff()` on `Client`. None of these are configurable through `HieroConfig`. Enterprise users must be able to tune these for production workloads.

Add optional fields to `HieroConfig`:
```ts
requestTimeoutMs?: number;   // default: 120_000 (2 min)
grpcDeadlineMs?: number;     // default: 10_000 (10 s)
maxAttempts?: number;        // default: 10
minBackoffMs?: number;       // default: 250
maxBackoffMs?: number;       // default: 8_000
```

---

### RESILIENCE-01: Mirror node `fetch()` calls have no timeout
**File:** `packages/core/src/mirror/mirror-node-client.ts`

A hung mirror node will block the request indefinitely. Add `AbortSignal.timeout(5_000)` (configurable) to every `fetch` call.

---

### RESILIENCE-02: Mirror node client has no retry logic
**File:** `packages/core/src/mirror/mirror-node-client.ts`

HTTP 429 / 503 / 5xx responses are returned as-is. Mirror nodes have intermittent availability. Implement exponential backoff with `Retry-After` header support for at least 3 attempts before giving up.

---

### RESILIENCE-03: Mirror node responses are cast without validation
**File:** `packages/core/src/mirror/mirror-node-client.ts`

```ts
return response.json() as Promise<T>;
```

Malformed or partial responses will produce runtime errors downstream with no diagnostic context. Add at minimum a null/shape guard, or adopt a lightweight schema validator (e.g. zod) at the mirror node boundary.

---

### ERR-01: `assertEnvConfigValid` throws plain `Error` instead of `HieroError`
**File:** `packages/core/src/config/hiero-config.ts`

All other failure paths in the library throw `HieroError`. Startup config validation uses a plain `Error`. Standardize on `HieroError` with a `CONFIG_INVALID` code.

---

### ERR-02: No key format validation before `PrivateKey.fromStringDer()`
**File:** `packages/core/src/config/hiero-config.ts`

An invalid key string throws an opaque SDK error. Catch it and wrap it in a `HieroError` with `CONFIG_INVALID` code and a message that identifies which env var is malformed.

---

## P1 — SDK Type Consistency

### TYPE-01: Mirror-node type names collide with SDK type names
**Files:** `packages/core/src/types/`

The enterprise-node defines `TokenInfo`, `AccountInfo`, `TopicMessage`, `CustomFee` etc. The SDK exports identically-named classes that serve a different purpose (consensus-node gRPC vs mirror-node REST). This will cause confusion for consumers who import from both.

**Recommendation:** Prefix all mirror-node-specific types with `Mirror`:

| Current name | Rename to | Reason |
|---|---|---|
| `TokenInfo` | `MirrorTokenInfo` | SDK has `TokenInfo` from `TokenInfoQuery` (gRPC) |
| `AccountInfo` | `MirrorAccountInfo` | SDK has `AccountInfo` from `AccountInfoQuery` (gRPC) |
| `TopicMessage` | `MirrorTopicMessage` | SDK has `TopicMessage` from subscription API (gRPC streaming) |
| `Topic` | `MirrorTopic` | No SDK equivalent but consistent naming |
| `CustomFee` | `MirrorCustomFee` | SDK has `CustomFee` class for `TokenCreateTransaction` |
| `FixedFee` / `FractionalFee` / `RoyaltyFee` | `MirrorFixedFee` etc. | SDK has `CustomFixedFee`, `CustomFractionalFee`, `CustomRoyaltyFee` classes |

Do NOT extend the SDK classes for these types. The mirror-node REST API shapes differ from the SDK gRPC shapes — `tokenInfo.keys` is a different structure, `customFees` have different field names, etc.

---

### TYPE-02: `TokenType` string union duplicates the SDK's `TokenType` class
**File:** `packages/core/src/types/token.ts:52`

```ts
export type TokenType = "FUNGIBLE_COMMON" | "NON_FUNGIBLE_UNIQUE";
```

The SDK exports `TokenType` with `.FUNGIBLE_COMMON` and `.NON_FUNGIBLE_UNIQUE`. For consensus-node operations (e.g. `TokenCreateTransaction.setTokenType()`), re-export or use the SDK's class directly. The string union is fine for mirror-node response parsing — keep it there under `MirrorTokenType`.

---

### TYPE-03: `Balance.hbars` typed as `number` — precision risk for large balances
**File:** `packages/core/src/types/balance.ts`

`Balance.hbars` stores tinybars as a JavaScript `number`. JavaScript's max safe integer is ~9 quadrillion tinybars (~90 billion HBAR). While most accounts won't exceed this, enterprise accounts with large holdings or staking rewards can. Change to `string` and document it as tinybars-as-string for precise representation. Apply the same fix to `TokenBalance.balance`.

---

### TYPE-04: SDK's `Hbar` class should be used internally, not `number`
**File:** `packages/core/src/services/account-client.ts`, throughout services

Service methods accept `initialBalance: number` (HBAR). Internally the SDK converts this via `new Hbar(n)`. Consider accepting `Hbar | number` for flexibility and precision — particularly useful when callers want to express tinybars directly.

---

### TYPE-05: `TopicMessage.sequenceNumber` typed as `number` — SDK uses `Long`
**File:** `packages/core/src/types/topic.ts:31`

The SDK's `TopicMessage.sequenceNumber` is a `Long`. Topics can have billions of messages. Type it as `string` (or `Long`) in `MirrorTopicMessage`.

---

### TYPE-06: `mirrorNodeClient` exposed in the public `HieroServices` object
**Files:** `packages/express/src/index.ts`, `packages/fastify/src/index.ts`

`mirrorNodeClient` is an internal HTTP client; it should not be part of the application-facing service interface. Repositories are the public interface for mirror node queries. Remove it from `HieroServices` or expose it under a separate `_internal` namespace.

---

## P2 — Polish

### PROJ-01: `dotenv` is a dead dependency
**File:** `packages/core/package.json`

`dotenv` is listed under `dependencies` but is never imported. The code uses `process.loadEnvFile()` (Node 20.12+). Either remove `dotenv` or document that `process.loadEnvFile` is the chosen mechanism (and add a `engines.node` constraint).

---

### PROJ-02: No `engines.node` / `engines.pnpm` fields in package.json files
`process.loadEnvFile` requires Node ≥ 20.12. Add `"engines": { "node": ">=20.12.0" }` to all `package.json` files and `"engines": { "pnpm": ">=9" }` to the workspace root.

---

### PROJ-03: `HieroContext.initialize()` silently ignores re-initialization
**File:** `packages/core/src/context/hiero-context.ts`

If `initialize()` is called twice with different configs, the second call is silently discarded. This makes misconfiguration invisible. Once ARCH-01 is resolved (instance-based model), this issue goes away. Until then, add a warning log or throw on re-initialization with different config.

---

### PROJ-04: README was generated and lacks real-world guidance
**File:** `README.md`

Missing:
- How to configure for local node (Solo / Hedera Local Node)
- How to configure SSL/TLS and custom endpoints
- Explanation of what Mirror Node queries are and when to use them vs consensus queries
- Error handling patterns (`HieroError` codes, what to catch)
- A `CHANGELOG.md`

---

### PROJ-05: No integration or end-to-end test suite
Unit tests mock everything. There are no tests that run against a real local node (Hedera Local Node / Solo). For an enterprise library, integration tests are the primary correctness signal — the unit tests that mock the SDK client only verify branching logic, not that transactions actually succeed.

---

### PROJ-06: `mirrorNodeClient.fetchNextPage` leaks a converter callback in the public API
**File:** `packages/core/src/mirror/mirror-node-client.ts`

```ts
fetchNextPage<T>(url: string, converter: (raw: unknown) => T): Promise<T>
```

The `converter` callback is an internal pagination concern. It should not be in the public signature of `MirrorNodeClient`. Move pagination logic into the individual repository methods or into a private helper.

---

## Summary

| Priority | Count | Categories |
|---|---|---|
| P0 | 9 | 6 bugs, 2 security, 1 architecture |
| P1 | 12 | 4 architecture, 2 resilience, 2 errors, 6 type consistency |
| P2 | 6 | Project hygiene |
| **Total** | **27** | |
