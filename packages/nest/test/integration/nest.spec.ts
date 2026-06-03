import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import {
    AccountService,
    HieroModule,
    OperatorKeyType,
} from "../../src/index.js";

const config = {
    network: "testnet",
    operatorId: "0.0.1001",
    operatorKeyType: OperatorKeyType.DER,
    operatorKey:
        "302e020100300506032b6570042204203b054ddd0c62d577ce0fbb0e92dcce0d5bea42a98a5c9663271939881ce19208",
};

describe("HieroModule", () => {
    it("uses non-global scope by default and supports opt-in global mode", () => {
        const defaultModule = HieroModule.forRoot(config);
        const globalModule = HieroModule.forRoot(config, { global: true });

        expect(defaultModule.global).toBe(false);
        expect(globalModule.global).toBe(true);
    });

    it("registers Hiero providers in a Nest testing module", async () => {
        const moduleRef = await Test.createTestingModule({
            imports: [HieroModule.forRoot(config)],
        }).compile();

        const accountService = moduleRef.get(AccountService);
        expect(accountService).toBeInstanceOf(AccountService);

        await moduleRef.close();
    });
});
