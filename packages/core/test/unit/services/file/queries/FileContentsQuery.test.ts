import { describe, it, expect, vi, beforeEach } from "vitest";
import { FileId } from "@hiero-ledger/sdk";
import { FileService } from "../../../../../src/services/file/index.js";
import { createMockContext } from "../../../../utils/mock-context.js";
import type { IHieroContext } from "../../../../../src/context/index.js";

const mocks = vi.hoisted(() => {
    const mockQuery = {
        setFileId: vi.fn().mockReturnThis(),
        execute: vi.fn(),
    };
    return { mockQuery };
});

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        FileContentsQuery: vi.fn(function () {
            return mocks.mockQuery;
        }),
    };
});

// Re-imported after vi.mock so the SdkFileContentsQuery constructor is the mock.
const { FileContentsQuery: SdkFileContentsQuery } =
    await import("@hiero-ledger/sdk");

describe("FileContentsQuery (via FileService)", () => {
    let context: IHieroContext;
    let service: FileService;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createMockContext();
        service = new FileService(context);
    });

    it("fetches raw file bytes and returns them unchanged", async () => {
        const payload = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
        mocks.mockQuery.execute.mockResolvedValueOnce(payload);

        const bytes = await service.getFileContents("0.0.555");

        expect(mocks.mockQuery.setFileId).toHaveBeenCalledWith("0.0.555");
        expect(mocks.mockQuery.execute).toHaveBeenCalledWith(context.client);
        expect(bytes).toBe(payload);
    });

    it("accepts a FileId instance", async () => {
        const fileId = FileId.fromString("0.0.999");
        mocks.mockQuery.execute.mockResolvedValueOnce(new Uint8Array([1]));

        await service.getFileContents(fileId);

        expect(mocks.mockQuery.setFileId).toHaveBeenCalledWith(fileId);
    });

    it("returns an empty Uint8Array for a deleted file", async () => {
        mocks.mockQuery.execute.mockResolvedValueOnce(new Uint8Array());

        const bytes = await service.getFileContents("0.0.555");

        expect(bytes.byteLength).toBe(0);
    });

    it("normalises SDK errors with the FileService.getFileContents context", async () => {
        mocks.mockQuery.execute.mockRejectedValueOnce(
            new Error("boom from network"),
        );

        await expect(service.getFileContents("0.0.555")).rejects.toMatchObject({
            name: "HieroError",
            context: "FileService.getFileContents",
            message: "boom from network",
        });
    });

    it("constructs a fresh SdkFileContentsQuery on every execute call", async () => {
        mocks.mockQuery.execute.mockResolvedValue(new Uint8Array([1]));

        await service.getFileContents("0.0.1");
        await service.getFileContents("0.0.2");

        expect(vi.mocked(SdkFileContentsQuery)).toHaveBeenCalledTimes(2);
    });
});
