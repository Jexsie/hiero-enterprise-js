import type { HieroContext } from "../context/index.js";
import type { AccountService } from "../services/account/index.js";
import type { TokenService } from "../services/token/index.js";
import type { ScheduleService } from "../services/schedule/index.js";
import type { FileService } from "../services/file-service.js";
import type { ContractService } from "../services/contract/index.js";
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
    scheduleService: ScheduleService;
    fileService: FileService;
    tokenService: TokenService;
    contractService: ContractService;
    topicService: TopicService;
    accountRepository: AccountRepository;
    nftRepository: NftRepository;
    tokenRepository: TokenRepository;
    topicRepository: TopicRepository;
    transactionRepository: TransactionRepository;
    networkRepository: NetworkRepository;
}
