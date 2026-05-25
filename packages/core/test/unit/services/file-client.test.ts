import { describe, it, expect, vi, beforeEach } from "vitest";
import { FileClient } from "../../../src/services/file-client.js";
import { createMockContext } from "../../utils/mock-context.js";
import type { HieroContext } from "../../../src/context/hiero-context.js";
import {
    FileCreateTransaction,
    FileContentsQuery,
    FileUpdateTransaction,
    FileDeleteTransaction,
    FileAppendTransaction,
    FileInfoQuery,
} from "@hiero-ledger/sdk";

vi.mock("@hiero-ledger/sdk", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@hiero-ledger/sdk")>();

    const mockTx = {
        setKeys: vi.fn().mockReturnThis(),
        setContents: vi.fn().mockReturnThis(),
        setExpirationTime: vi.fn().mockReturnThis(),
        setFileId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({
            transactionId: { toString: () => "0.0.123@1234567890.000000000" },
            getReceipt: vi.fn().mockResolvedValue({
                status: { toString: () => "SUCCESS" },
                fileId: { toString: () => "0.0.999" },
            }),
        }),
    };

    const mockContentsQuery = {
        setFileId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    };

    const mockInfoQuery = {
        setFileId: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({
            isDeleted: true,
            size: { toNumber: () => 1024 },
            expirationTime: { toDate: () => new Date("2030-01-01T00:00:00Z") },
        }),
    };

    return {
        ...actual,
        FileCreateTransaction: vi.fn(() => ({ ...mockTx })),
        FileAppendTransaction: vi.fn(() => ({ ...mockTx })),
        FileUpdateTransaction: vi.fn(() => ({ ...mockTx })),
        FileDeleteTransaction: vi.fn(() => ({ ...mockTx })),
        FileContentsQuery: vi.fn(() => ({ ...mockContentsQuery })),
        FileInfoQuery: vi.fn(() => ({ ...mockInfoQuery })),
    };
});

describe("FileClient", () => {
    let context: HieroContext;
    let client: FileClient;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createMockContext();
        client = new FileClient(context);
    });

    describe("createFile", () => {
        it("creates a file under 4KB without chunking", async () => {
            const contents = new Uint8Array(100);
            const expires = new Date();

            const fileId = await client.createFile(contents, expires);

            expect(fileId).toBe("0.0.999");

            const createMock = vi.mocked(FileCreateTransaction).mock.results[0]
                .value;
            expect(createMock.setContents).toHaveBeenCalledWith(contents);
            expect(createMock.setExpirationTime).toHaveBeenCalledWith(expires);
            expect(createMock.execute).toHaveBeenCalledWith(context.client);
        });

        it("creates a file over 4KB using chunking", async () => {
            const contents = new Uint8Array(5000); // Over 4KB

            const fileId = await client.createFile(
                contents,
                new Date("2030-01-01"),
            );

            expect(fileId).toBe("0.0.999");
            // First 4KB goes in FileCreateTransaction, rest in FileAppendTransaction
            expect(FileCreateTransaction).toHaveBeenCalled();
            expect(FileAppendTransaction).toHaveBeenCalled();
        });
    });

    describe("readFile", () => {
        it("reads file contents", async () => {
            const contents = await client.readFile("0.0.999");

            expect(contents).toEqual(new Uint8Array([1, 2, 3]));

            const queryMock = vi.mocked(FileContentsQuery).mock.results[0]
                .value;
            expect(queryMock.setFileId).toHaveBeenCalledWith("0.0.999");
            expect(queryMock.execute).toHaveBeenCalledWith(context.client);
        });
    });

    describe("updateFile", () => {
        it("updates file contents", async () => {
            const contents = new Uint8Array(100);
            await client.updateFile("0.0.999", contents);

            const txMock = vi.mocked(FileUpdateTransaction).mock.results[0]
                .value;
            expect(txMock.setFileId).toHaveBeenCalledWith("0.0.999");
            expect(txMock.setContents).toHaveBeenCalledWith(contents);
        });
    });

    describe("deleteFile", () => {
        it("deletes a file", async () => {
            await client.deleteFile("0.0.999");

            const txMock = vi.mocked(FileDeleteTransaction).mock.results[0]
                .value;
            expect(txMock.setFileId).toHaveBeenCalledWith("0.0.999");
            expect(txMock.execute).toHaveBeenCalledWith(context.client);
        });
    });

    describe("isDeleted", () => {
        it("checks if file is deleted", async () => {
            const deleted = await client.isDeleted("0.0.999");
            expect(deleted).toBe(true);
        });
    });

    describe("getSize", () => {
        it("gets file size", async () => {
            const size = await client.getSize("0.0.999");
            expect(size).toBe(1024);
        });
    });

    describe("getExpirationTime", () => {
        it("gets file expiration time", async () => {
            const expiration = await client.getExpirationTime("0.0.999");
            expect(expiration).toEqual(new Date("2030-01-01T00:00:00Z"));
        });
    });
});
