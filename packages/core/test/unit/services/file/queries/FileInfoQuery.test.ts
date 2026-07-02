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
        FileInfoQuery: vi.fn(function () {
            return mocks.mockQuery;
        }),
    };
});

// Re-imported after vi.mock so the SdkFileInfoQuery constructor is the mock.
const { FileInfoQuery: SdkFileInfoQuery } = await import("@hiero-ledger/sdk");

function buildSdkFileInfo(overrides: Record<string, unknown> = {}) {
    return {
        fileId: FileId.fromString("0.0.555"),
        size: { toNumber: () => 1024 },
        expirationTime: {
            toDate: () => new Date("2099-01-02T03:04:05.000Z"),
        },
        isDeleted: false,
        keys: { _keyListSentinel: true },
        fileMemo: "demo file",
        ledgerId: { toString: () => "mainnet" },
        ...overrides,
    };
}

describe("FileInfoQuery (via FileService)", () => {
    let context: IHieroContext;
    let service: FileService;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createMockContext();
        service = new FileService(context);
    });

    it("fetches and projects file info to a plain object", async () => {
        mocks.mockQuery.execute.mockResolvedValueOnce(buildSdkFileInfo());

        const info = await service.getFileInfo("0.0.555");

        expect(mocks.mockQuery.setFileId).toHaveBeenCalledWith("0.0.555");
        expect(mocks.mockQuery.execute).toHaveBeenCalledWith(context.client);

        expect(info).toMatchObject({
            fileId: "0.0.555",
            size: 1024,
            expirationTime: "2099-01-02T03:04:05.000Z",
            isDeleted: false,
            fileMemo: "demo file",
            ledgerId: "mainnet",
        });
        // Keys pass through as the original SDK reference.
        expect(info.keys).toEqual({ _keyListSentinel: true });
    });

    it("accepts a FileId instance", async () => {
        const fileId = FileId.fromString("0.0.999");
        mocks.mockQuery.execute.mockResolvedValueOnce(
            buildSdkFileInfo({ fileId }),
        );

        const info = await service.getFileInfo(fileId);

        expect(mocks.mockQuery.setFileId).toHaveBeenCalledWith(fileId);
        expect(info.fileId).toBe("0.0.999");
    });

    it("returns null for optional fields when the SDK reports them as null", async () => {
        mocks.mockQuery.execute.mockResolvedValueOnce(
            buildSdkFileInfo({
                expirationTime: null,
                keys: null,
                ledgerId: null,
            }),
        );

        const info = await service.getFileInfo("0.0.555");

        expect(info.expirationTime).toBeNull();
        expect(info.keys).toBeNull();
        expect(info.ledgerId).toBeNull();
    });

    it("reflects isDeleted when the file has been deleted", async () => {
        mocks.mockQuery.execute.mockResolvedValueOnce(
            buildSdkFileInfo({
                isDeleted: true,
                size: { toNumber: () => 0 },
            }),
        );

        const info = await service.getFileInfo("0.0.555");

        expect(info.isDeleted).toBe(true);
        expect(info.size).toBe(0);
    });

    it("normalises SDK errors with the FileService.getFileInfo context", async () => {
        mocks.mockQuery.execute.mockRejectedValueOnce(
            new Error("boom from network"),
        );

        await expect(service.getFileInfo("0.0.555")).rejects.toMatchObject({
            name: "HieroError",
            context: "FileService.getFileInfo",
            message: "boom from network",
        });
    });

    it("constructs a fresh SdkFileInfoQuery on every execute call", async () => {
        mocks.mockQuery.execute.mockResolvedValue(buildSdkFileInfo());

        await service.getFileInfo("0.0.1");
        await service.getFileInfo("0.0.2");

        expect(vi.mocked(SdkFileInfoQuery)).toHaveBeenCalledTimes(2);
    });
});
