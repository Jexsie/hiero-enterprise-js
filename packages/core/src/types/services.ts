import type { HieroContext } from "../context/index.js";
import type { AccountClient } from "../services/account-client.js";
import type { FileClient } from "../services/file-client.js";
import type { FungibleTokenClient } from "../services/fungible-token-client.js";
import type { NftClient } from "../services/nft-client.js";
import type { SmartContractClient } from "../services/smart-contract-client.js";
import type { TopicClient } from "../services/topic-client.js";
import type { AccountRepository } from "../repositories/account-repository.js";
import type { NftRepository } from "../repositories/nft-repository.js";
import type { TokenRepository } from "../repositories/token-repository.js";
import type { TopicRepository } from "../repositories/topic-repository.js";
import type { TransactionRepository } from "../repositories/transaction-repository.js";
import type { NetworkRepository } from "../repositories/network-repository.js";

/**
 * All services made available through framework integrations.
 * Shared by Express middleware, Fastify plugin, and NestJS module.
 */
export interface HieroServices {
    context: HieroContext;
    accountClient: AccountClient;
    fileClient: FileClient;
    fungibleTokenClient: FungibleTokenClient;
    nftClient: NftClient;
    smartContractClient: SmartContractClient;
    topicClient: TopicClient;
    accountRepository: AccountRepository;
    nftRepository: NftRepository;
    tokenRepository: TokenRepository;
    topicRepository: TopicRepository;
    transactionRepository: TransactionRepository;
    networkRepository: NetworkRepository;
}
