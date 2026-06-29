import type { HieroConfig } from "../config/index.js";
import { resolveMirrorNodeUrl } from "../config/index.js";
import { HieroContext } from "../context/index.js";
import { MirrorNodeClient } from "../mirror/index.js";
import {
    AccountRepository,
    TokenRepository,
    TopicRepository,
    TransactionRepository,
    NetworkRepository,
    NftRepository,
} from "../repositories/index.js";
import {
    AccountService,
    FileService,
    TokenService,
    ContractService,
    TopicService,
    ScheduleService,
} from "../services/index.js";
import type { HieroServices } from "../types/index.js";

export interface HieroRuntime extends HieroServices {
    mirrorNodeClient: MirrorNodeClient;
    close(): void;
}

/**
 * Create the full Hiero runtime graph used by framework adapters.
 */
export function createHieroRuntime(config?: HieroConfig): HieroRuntime {
    const context = new HieroContext(config);
    const mirrorNodeUrl = resolveMirrorNodeUrl(
        context.config.network,
        context.config.mirrorNodeUrl,
    );
    const mirrorNodeClient = new MirrorNodeClient(mirrorNodeUrl, {
        timeoutMs: context.config.mirrorNodeTimeoutMs,
        maxRetries: context.config.mirrorNodeMaxRetries,
    });

    return {
        context,
        mirrorNodeClient,
        accountService: new AccountService(context),
        scheduleService: new ScheduleService(context),
        fileService: new FileService(context),
        tokenService: new TokenService(context),
        contractService: new ContractService(context),
        topicService: new TopicService(context),
        accountRepository: new AccountRepository(mirrorNodeClient),
        nftRepository: new NftRepository(mirrorNodeClient),
        tokenRepository: new TokenRepository(mirrorNodeClient),
        topicRepository: new TopicRepository(mirrorNodeClient),
        transactionRepository: new TransactionRepository(mirrorNodeClient),
        networkRepository: new NetworkRepository(mirrorNodeClient),
        close: () => context.close(),
    };
}

/**
 * Adapter-facing helper when only the public services surface is needed.
 */
export function createHieroServices(config?: HieroConfig): HieroServices {
    const {
        mirrorNodeClient: _mirrorNodeClient,
        close: _close,
        ...services
    } = createHieroRuntime(config);
    return services;
}
