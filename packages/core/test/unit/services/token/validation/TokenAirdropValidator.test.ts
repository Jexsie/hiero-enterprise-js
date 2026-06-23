import { describe, it, expect } from "vitest";
import { AccountId, Long } from "@hiero-ledger/sdk";
import BigNumber from "bignumber.js";
import { TokenAirdropValidator } from "../../../../../src/services/token/validation/index.js";
import type { TokenAirdropOperationOptions } from "../../../../../src/services/token/operations/index.js";

describe("TokenAirdropValidator", () => {
    const validator = new TokenAirdropValidator();

    const baseOptions: TokenAirdropOperationOptions = {
        tokenId: "0.0.500",
        senderAccountId: "0.0.700",
        receiverAccountId: "0.0.800",
        amount: 10,
    };

    describe("tokenId", () => {
        it("passes with valid options", () => {
            expect(() => validator.validate(baseOptions)).not.toThrow();
        });

        it("throws when tokenId is null", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    tokenId: null as unknown as string,
                }),
            ).toThrow(/tokenId is required/);
        });

        it("throws when tokenId is whitespace only", () => {
            expect(() =>
                validator.validate({ ...baseOptions, tokenId: "   " }),
            ).toThrow(/tokenId cannot be empty/);
        });
    });

    describe("senderAccountId / receiverAccountId", () => {
        it("throws when senderAccountId is undefined", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    senderAccountId: undefined as unknown as string,
                }),
            ).toThrow(/senderAccountId is required/);
        });

        it("throws when senderAccountId is empty", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    senderAccountId: "   ",
                }),
            ).toThrow(/senderAccountId cannot be empty/);
        });

        it("throws when receiverAccountId is null", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    receiverAccountId: null as unknown as string,
                }),
            ).toThrow(/receiverAccountId is required/);
        });

        it("throws when receiverAccountId is empty", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    receiverAccountId: "",
                }),
            ).toThrow(/receiverAccountId cannot be empty/);
        });

        it("throws when sender and receiver are the same account string", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    senderAccountId: "0.0.700",
                    receiverAccountId: "0.0.700",
                }),
            ).toThrow(
                /senderAccountId and receiverAccountId must be different/,
            );
        });

        it("throws when sender and receiver are the same AccountId object", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    senderAccountId: AccountId.fromString("0.0.700"),
                    receiverAccountId: AccountId.fromString("0.0.700"),
                }),
            ).toThrow(
                /senderAccountId and receiverAccountId must be different/,
            );
        });

        it("accepts distinct AccountId objects for sender and receiver", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    senderAccountId: AccountId.fromString("0.0.700"),
                    receiverAccountId: AccountId.fromString("0.0.800"),
                }),
            ).not.toThrow();
        });
    });

    describe("amount", () => {
        it("throws when amount is null", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    amount: null as unknown as number,
                }),
            ).toThrow(/amount is required/);
        });

        it("throws when amount is zero (number)", () => {
            expect(() =>
                validator.validate({ ...baseOptions, amount: 0 }),
            ).toThrow(/amount must be a positive value/);
        });

        it("throws when amount is negative (number)", () => {
            expect(() =>
                validator.validate({ ...baseOptions, amount: -5 }),
            ).toThrow(/amount must be a positive value/);
        });

        it("throws when amount is zero (bigint)", () => {
            expect(() =>
                validator.validate({ ...baseOptions, amount: 0n }),
            ).toThrow(/amount must be a positive value/);
        });

        it("throws when amount is negative (bigint)", () => {
            expect(() =>
                validator.validate({ ...baseOptions, amount: -1n }),
            ).toThrow(/amount must be a positive value/);
        });

        it("throws when amount is negative (Long)", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    amount: Long.fromNumber(-1),
                }),
            ).toThrow(/amount must be a positive value/);
        });

        it("throws when amount is zero (Long)", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    amount: Long.ZERO,
                }),
            ).toThrow(/amount must be a positive value/);
        });

        it("throws when amount is zero (BigNumber)", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    amount: new BigNumber(0),
                }),
            ).toThrow(/amount must be a positive value/);
        });

        it("accepts positive bigint amounts", () => {
            expect(() =>
                validator.validate({ ...baseOptions, amount: 5n }),
            ).not.toThrow();
        });

        it("accepts positive Long amounts", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    amount: Long.fromNumber(5),
                }),
            ).not.toThrow();
        });

        it("accepts positive BigNumber amounts", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    amount: new BigNumber(5),
                }),
            ).not.toThrow();
        });
    });

    describe("expectedDecimals", () => {
        it("accepts an undefined expectedDecimals", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    expectedDecimals: undefined,
                }),
            ).not.toThrow();
        });

        it("accepts zero expectedDecimals", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    expectedDecimals: 0,
                }),
            ).not.toThrow();
        });

        it("throws when expectedDecimals is negative", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    expectedDecimals: -1,
                }),
            ).toThrow(/expectedDecimals must be a non-negative integer/);
        });

        it("throws when expectedDecimals is non-integer", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    expectedDecimals: 1.5,
                }),
            ).toThrow(/expectedDecimals must be a non-negative integer/);
        });
    });
});
