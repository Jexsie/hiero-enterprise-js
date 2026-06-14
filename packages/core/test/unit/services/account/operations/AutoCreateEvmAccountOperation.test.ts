import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountService } from "../../../../../src/services/account/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import { reattachMockChain } from "../../../../utils/sdk-mocks.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = await vi.hoisted(async () => {
    const { buildMockTxBundle } =
        await import("../../../../utils/sdk-mocks.js");
    return buildMockTxBundle(["addHbarTransfer"]);
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        TransferTransaction: vi.fn(function () {
            return mocks.tx;
        }),
    };
});

describe("AutoCreateEvmAccountOperation (via AccountService)", () => {
    let context: IHieroContext;
    let service: AccountService;

    beforeEach(() => {
        vi.clearAllMocks();
        reattachMockChain(mocks);
        context = createMockContext();
        service = new AccountService(context);
    });

    describe("autoCreateEvmAccount", () => {
        it("transfers HBAR to seed the EVM address", async () => {
            await service.autoCreateEvmAccount({
                evmAddress: "0x" + "a".repeat(40),
                amount: 5,
            });

            expect(mocks.tx.addHbarTransfer).toHaveBeenCalledTimes(2);
            expect(mocks.tx.execute).toHaveBeenCalledWith(context.client);
        });
    });

    describe("scheduleAutoCreateEvmAccount", () => {
        it("schedules the hollow-account transfer", async () => {
            const result = await service.scheduleAutoCreateEvmAccount({
                evmAddress: "0x" + "a".repeat(40),
                amount: 5,
            });

            expect(mocks.tx.schedule).toHaveBeenCalled();
            expect(result.scheduleId).toBe("0.0.777");
        });
    });
});
