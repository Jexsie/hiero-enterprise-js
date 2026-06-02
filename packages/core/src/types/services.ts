import type { HieroContext } from "../context/index.js";
import type { AccountService } from "../services/account-service.js";
import type { FileService } from "../services/file-service.js";
import type { FungibleTokenService } from "../services/fungible-token-service.js";
import type { NftService } from "../services/nft-service.js";
import type { SmartContractService } from "../services/smart-contract-service.js";
import type { TopicService } from "../services/topic-service.js";
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
    accountService: AccountService;
    fileService: FileService;
    fungibleTokenService: FungibleTokenService;
    nftService: NftService;
    smartContractService: SmartContractService;
    topicService: TopicService;
    accountRepository: AccountRepository;
    nftRepository: NftRepository;
    tokenRepository: TokenRepository;
    topicRepository: TopicRepository;
    transactionRepository: TransactionRepository;
    networkRepository: NetworkRepository;
}
