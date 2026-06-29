/**
 * Execute Contract — invoke a state-mutating function on a deployed Hiero
 * smart contract (HSCS).
 *
 * Demonstrates every call-target form exposed by ContractService:
 *
 * - `executeContract` with `functionName` + ABI-typed `functionParameters`
 *   — the everyday path; the SDK encodes the call data
 * - `executeContract` with `rawFunctionParameters` — pre-encoded ABI bytes
 *   for advanced callers that build call data themselves
 * - `executeContract` with `payableAmount` — forward HBAR into a payable
 *   function alongside the call
 * - `scheduleExecuteContract` — defer the call behind a scheduled
 *   transaction so additional parties can sign before it executes
 *
 * `executeContract` returns nothing: the contract ID is already known to
 * the caller, and per-call status / timing is delivered through the
 * `before` / `after` listener events on the surrounding `HieroContext`.
 * The call's return bytes, gas used, and logs live on the transaction
 * record (a separate paid query) — fetch the record directly via the SDK
 * if your caller needs them.
 *
 * For read-only state queries that don't mutate the ledger, prefer a
 * `ContractCallQuery` — no consensus round-trip, no gas charged on success.
 *
 * Run: pnpm tsx src/contract/execute-contract.ts
 */

import {
    ContractFunctionParameters,
    ContractService,
    Hbar,
    HieroContext,
} from "@hiero-enterprise/core";
import { getED25519Config } from "../env.js";

/**
 * SimpleStorage — solc 0.8.20 (optimized) output of:
 *
 *   contract SimpleStorage {
 *       uint256 private storedValue;
 *       event ValueSet(uint256 value);
 *       function set(uint256 x) public { storedValue = x; emit ValueSet(x); }
 *       function get() public view returns (uint256) { return storedValue; }
 *       function deposit() public payable {}
 *   }
 *
 * Function selectors:
 *   set(uint256) → 0x60fe47b1
 *   get()        → 0x6d4ce63c
 *   deposit()    → 0xd0e30db0
 */
const SIMPLE_STORAGE_BYTECODE_HEX =
    "608060405234801561000f575f80fd5b5060f48061001c5f395ff3fe608060405260043610602f575f3560e01c806360fe47b11460335780636d4ce63c14604f578063d0e30db014604d575b5f80fd5b348015603d575f80fd5b50604d604936600460a8565b606e565b005b3480156059575f80fd5b505f5460405190815260200160405180910390f35b5f8190556040518181527f012c78e2b84325878b1bd9d250d772cfe5bda7722d795f45036fa5e1e6e303fc9060200160405180910390a150565b5f6020828403121560b7575f80fd5b503591905056fea264697066735822122009540154e6be64adb0401ec95d58627b313e4e6d7f71ea91e91644a51371a05b64736f6c63430008140033";

/**
 * Deploys a fresh SimpleStorage contract using HIP-435 inline bytecode so
 * the example is self-contained — no FileService upload required.
 */
async function deploySimpleStorage(
    contractService: ContractService,
): Promise<string> {
    const contractId = await contractService.createContract({
        bytecode: Buffer.from(SIMPLE_STORAGE_BYTECODE_HEX, "hex"),
        gas: 200_000,
        contractMemo: "execute-contract sample target",
    });
    console.log("Deployed SimpleStorage contract:", contractId);
    console.log();
    return contractId;
}

/**
 * Demonstrates the everyday call path: SDK-encoded ABI parameters.
 *
 * The SDK builds the call data — function selector for `set(uint256)`
 * plus the encoded `42` argument — using the typed
 * `ContractFunctionParameters` helper. This is the recommended path
 * for almost every call.
 */
async function executeWithTypedParameters(
    contractService: ContractService,
    contractId: string,
) {
    console.log("=== Execute with typed parameters ===\n");

    await contractService.executeContract({
        contractId,
        gas: 100_000,
        functionName: "set",
        functionParameters: new ContractFunctionParameters().addUint256(42),
    });

    console.log("Called set(42) — call accepted by the network");
    console.log();
}

/**
 * Demonstrates the advanced call path: pre-encoded raw ABI bytes.
 *
 * Use this when the call data is produced upstream (e.g., by an external
 * ABI encoder, a relayed transaction, or a contract proxy). The bytes are
 * the function selector concatenated with ABI-encoded arguments.
 */
async function executeWithRawBytes(
    contractService: ContractService,
    contractId: string,
) {
    console.log("=== Execute with pre-encoded raw bytes ===\n");

    // selector("set(uint256)") || uint256(7), padded to 32 bytes
    const rawCallData = Buffer.from(
        "60fe47b1" +
            "0000000000000000000000000000000000000000000000000000000000000007",
        "hex",
    );

    await contractService.executeContract({
        contractId,
        gas: 100_000,
        rawFunctionParameters: new Uint8Array(rawCallData),
    });

    console.log("Called set(7) via raw bytes — call accepted by the network");
    console.log();
}

/**
 * Demonstrates calling a `payable` function while forwarding HBAR.
 *
 * `payableAmount` is the HBAR sent into the contract alongside the call;
 * the network rejects the transaction if the target function is not
 * marked `payable`. Accepts `number`, `string`, `Long`, `BigNumber`,
 * `Hbar`, or `bigint` — pass whatever your caller already has.
 */
async function executePayableCall(
    contractService: ContractService,
    contractId: string,
) {
    console.log("=== Execute payable function with HBAR forwarded ===\n");

    await contractService.executeContract({
        contractId,
        gas: 100_000,
        functionName: "deposit",
        payableAmount: new Hbar(1),
    });

    console.log("Called deposit() with 1 HBAR — call accepted by the network");
    console.log();
}

/**
 * Demonstrates scheduling a contract call.
 *
 * Returns a `scheduleId` immediately — the inner call is NOT executed
 * yet. Other parties sign through `ScheduleService` (or another client
 * submitting a `ScheduleSignTransaction`); once the required signatures
 * are collected, the network executes the contract call automatically.
 *
 * Useful for governance flows where a contract should only be called
 * after multiple approvals.
 */
async function scheduleExecuteCall(
    contractService: ContractService,
    contractId: string,
) {
    console.log("=== Schedule a contract execution ===\n");

    const scheduled = await contractService.scheduleExecuteContract(
        {
            contractId,
            gas: 100_000,
            functionName: "set",
            functionParameters: new ContractFunctionParameters().addUint256(99),
        },
        { scheduleMemo: "pending council approval" },
    );

    console.log("Schedule ID:", scheduled.scheduleId);
    console.log("Transaction ID:", scheduled.transactionId);
    console.log();
}

async function main() {
    const context = new HieroContext(getED25519Config());
    const contractService = new ContractService(context);
    try {
        const contractId = await deploySimpleStorage(contractService);
        await executeWithTypedParameters(contractService, contractId);
        await executeWithRawBytes(contractService, contractId);
        await executePayableCall(contractService, contractId);
        await scheduleExecuteCall(contractService, contractId);
        console.log("All contract execute scenarios complete.");
    } finally {
        context.client.close();
    }
}

void main().catch((error) => {
    console.error("execute-contract sample failed:", error);
    process.exitCode = 1;
});
