import { describe, it, expect } from "vitest";
import { FileCreateValidator } from "../../../../../src/services/file/validation/index.js";

describe("FileCreateValidator", () => {
    const validator = new FileCreateValidator();

    it("accepts non-empty string contents", () => {
        expect(() => validator.validate({ contents: "hello" })).not.toThrow();
    });

    it("accepts non-empty Uint8Array contents", () => {
        expect(() =>
            validator.validate({ contents: new Uint8Array([1, 2, 3]) }),
        ).not.toThrow();
    });

    it("accepts an empty options object (empty file creation)", () => {
        // Every field on the create surface is optional — matches the
        // SDK's `FileCreateTransaction`, which permits an empty file.
        expect(() => validator.validate({})).not.toThrow();
    });
});
