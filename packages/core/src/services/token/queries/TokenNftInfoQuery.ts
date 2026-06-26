import type { NftId } from "@hiero-ledger/sdk";
import { TokenNftInfoQuery as SdkTokenNftInfoQuery } from "@hiero-ledger/sdk";
import type { IHieroContext } from "../../../context/index.js";
import {
    HieroError,
    HieroErrorCodes,
    normalizeError,
} from "../../../errors/index.js";

/**
 * A plain-object representation of a single NFT serial.
 *
 * Maps the SDK's `TokenNftInfo` to JS-friendly types so callers are not
 * coupled to SDK primitives like `Timestamp`.
 *
 * Returned by `TokenService.getNftInfo`. Per-serial information is only
 * applicable to NFT collections (`TokenType.NonFungibleUnique`) — for
 * the parent collection's metadata use `TokenService.getTokenInfo`.
 */
export interface TokenNftInfoResult {
    /** The NFT identifier formatted as `"<tokenId>/<serial>"` (e.g., `"0.0.12345/7"`). */
    nftId: string;
    /** The parent NFT collection token ID (e.g., `"0.0.12345"`). */
    tokenId: string;
    /** The serial number within the collection, stringified to preserve precision. */
    serial: string;
    /** The account that currently owns this serial. */
    accountId: string;
    /** ISO-8601 timestamp of when the serial was minted. */
    creationTime: string;
    /** The metadata bytes attached to this serial when it was minted, or `null` if none. */
    metadata: Uint8Array | null;
    /** Account approved to spend this serial via `nftApprove`, or `null` if no approval. */
    spenderId: string | null;
    /** Ledger this NFT lives on (mainnet / testnet / previewnet), as a hex string. */
    ledgerId: string | null;
}

/**
 * Read-only query for a single NFT serial.
 *
 * Wraps the SDK's `TokenNftInfoQuery` and projects the single result to a
 * plain `TokenNftInfoResult` object decoupled from SDK primitives.
 *
 * The underlying SDK query can also operate in list mode, but this
 * wrapper is intentionally scoped to single-serial lookups — pass the
 * exact `NftId` (or `"<tokenId>/<serial>"` string) of the serial to
 * inspect.
 */
export class TokenNftInfoQuery {
    constructor(private readonly context: IHieroContext) {}

    /**
     * Fetch info about the given NFT serial.
     *
     * @param nftId - The NFT serial (an `NftId` instance or a
     *   `"<tokenId>/<serial>"` / `"<tokenId>@<serial>"` string)
     * @returns Plain-object info for the requested serial — throws if the
     *          serial does not exist or the network rejects the query
     */
    async execute(nftId: string | NftId): Promise<TokenNftInfoResult> {
        try {
            const infos = await new SdkTokenNftInfoQuery()
                .setNftId(nftId)
                .execute(this.context.client);

            const info = infos[0];
            if (info == null) {
                throw new HieroError(
                    `No NFT info returned for ${nftId.toString()}`,
                    {
                        code: HieroErrorCodes.NotFound,
                        context: "TokenService.getNftInfo",
                    },
                );
            }

            return {
                nftId: info.nftId.toString(),
                tokenId: info.nftId.tokenId.toString(),
                serial: info.nftId.serial.toString(),
                accountId: info.accountId.toString(),
                creationTime: info.creationTime.toDate().toISOString(),
                metadata: info.metadata,
                spenderId: info.spenderId?.toString() ?? null,
                ledgerId: info.ledgerId?.toString() ?? null,
            };
        } catch (error) {
            throw normalizeError(error, "TokenService.getNftInfo");
        }
    }
}
