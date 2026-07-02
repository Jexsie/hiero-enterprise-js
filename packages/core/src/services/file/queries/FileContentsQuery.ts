import type { FileId } from "@hiero-ledger/sdk";
import { FileContentsQuery as SdkFileContentsQuery } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import { normalizeError } from "../../../errors/index.js";

/**
 * Read-only consensus query for file contents.
 *
 * Wraps the SDK's `FileContentsQuery` and returns the raw file bytes.
 * Hits the consensus nodes directly — returns the most current state
 * with no mirror-node propagation lag.
 *
 * Deleted files return a zero-length payload (rather than throwing).
 */
export class FileContentsQuery {
    constructor(private readonly context: IHieroContext) {}

    /**
     * Fetch the current contents of a file from the consensus nodes.
     *
     * @param fileId - The file entity ID (e.g., `"0.0.12345"`)
     * @returns The raw file bytes — empty for a deleted file
     */
    async execute(fileId: string | FileId): Promise<Uint8Array> {
        try {
            return await new SdkFileContentsQuery()
                .setFileId(fileId)
                .execute(this.context.client);
        } catch (error) {
            throw normalizeError(error, "FileService.getFileContents");
        }
    }
}
