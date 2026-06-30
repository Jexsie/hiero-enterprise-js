import { describe, it, expect } from "vitest";
import { TopicUpdateValidator } from "../../../../../src/services/topic/validation/index.js";
import type { TopicUpdateOperationOptions } from "../../../../../src/services/topic/operations/index.js";

describe("TopicUpdateValidator", () => {
    const validator = new TopicUpdateValidator();

    const baseOptions: TopicUpdateOperationOptions = {
        topicId: "0.0.12345",
    };

    describe("topicId", () => {
        it("accepts a string topic ID", () => {
            expect(() => validator.validate(baseOptions)).not.toThrow();
        });

        it("throws when topicId is missing", () => {
            expect(() =>
                validator.validate(
                    {} as unknown as TopicUpdateOperationOptions,
                ),
            ).toThrow(/topicId is required/);
        });

        it("throws when topicId is an empty string", () => {
            expect(() =>
                validator.validate({ ...baseOptions, topicId: "" }),
            ).toThrow(/topicId cannot be empty/);
        });

        it("throws when topicId is whitespace only", () => {
            expect(() =>
                validator.validate({ ...baseOptions, topicId: "   " }),
            ).toThrow(/topicId cannot be empty/);
        });
    });

    describe("topicMemo", () => {
        it("accepts a memo at the 100-byte boundary", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    topicMemo: "x".repeat(100),
                }),
            ).not.toThrow();
        });

        it("accepts an empty-string memo", () => {
            expect(() =>
                validator.validate({ ...baseOptions, topicMemo: "" }),
            ).not.toThrow();
        });

        it("accepts a null memo (clears the memo)", () => {
            expect(() =>
                validator.validate({ ...baseOptions, topicMemo: null }),
            ).not.toThrow();
        });

        it("throws when memo exceeds 100 bytes", () => {
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    topicMemo: "x".repeat(101),
                }),
            ).toThrow(/topicMemo exceeds 100 bytes/);
        });

        it("counts byte length using UTF-8 (multi-byte characters)", () => {
            // Each "あ" is 3 UTF-8 bytes — 34 × 3 = 102 > 100.
            expect(() =>
                validator.validate({
                    ...baseOptions,
                    topicMemo: "あ".repeat(34),
                }),
            ).toThrow(/topicMemo exceeds 100 bytes/);
        });
    });
});
