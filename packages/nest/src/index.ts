import {
    Module,
    type DynamicModule,
    type Provider,
    type Type,
    type ForwardReference,
    type InjectionToken,
} from "@nestjs/common";
import type { HieroConfig } from "@hiero-enterprise/core";
import {
    createHieroRuntime,
    type HieroRuntime,
    resolveConfigFromEnv,
    assertEnvConfigValid,
    MirrorNodeClient,
    AccountService,
    FileService,
    FungibleTokenService,
    NftService,
    SmartContractService,
    TopicService,
    AccountRepository,
    NftRepository,
    TokenRepository,
    TopicRepository,
    TransactionRepository,
    NetworkRepository,
} from "@hiero-enterprise/core";

// ─── Injection Tokens ──────────────────────────────────────────

export const HIERO_CONFIG = "HIERO_CONFIG";
export const HIERO_CONTEXT = "HIERO_CONTEXT";
const HIERO_RUNTIME = "HIERO_RUNTIME";

type NestImport =
    | Type<unknown>
    | DynamicModule
    | Promise<DynamicModule>
    | ForwardReference;

/**
 * Options for async configuration of HieroModule.
 */
export interface HieroModuleAsyncOptions {
    /** Imports needed for config injection */
    imports?: NestImport[];
    /** Factory function returning HieroConfig */
    useFactory: (...args: unknown[]) => HieroConfig | Promise<HieroConfig>;
    /** Dependencies to inject into the factory */
    inject?: InjectionToken[];
    /** Whether this module should be global in the Nest container */
    global?: boolean;
}

// ─── HieroModule ───────────────────────────────────────────────

/**
 * NestJS module that provides all Hiero services via dependency injection.
 *
 * @example
 * ```ts
 * // Option 1: Environment-based config
 * import { HieroModule } from '@hiero-enterprise/nest';
 * @Module({ imports: [HieroModule.forRoot()] })
 * export class AppModule {}
 *
 * // Option 2: Explicit config
 * @Module({
 *   imports: [HieroModule.forRoot({ network: 'testnet', operatorId: '0.0.1', operatorKey: '302e...' })]
 * })
 * export class AppModule {}
 *
 * // Option 3: Async config (e.g., from ConfigService)
 * @Module({
 *   imports: [HieroModule.forRootAsync({
 *     imports: [ConfigModule],
 *     inject: [ConfigService],
 *     useFactory: (config: ConfigService) => ({
 *       network: config.get('HIERO_NETWORK'),
 *       operatorId: config.get('HIERO_OPERATOR_ID'),
 *       operatorKey: config.get('HIERO_OPERATOR_KEY'),
 *     }),
 *   })]
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class HieroModule {
    /**
     * Register the module with all Hiero services as providers.
     *
     * @param config - Optional explicit config (falls back to env vars)
     * @returns Dynamic NestJS module definition
     */
    static forRoot(
        config?: HieroConfig,
        opts?: { global?: boolean },
    ): DynamicModule {
        if (!config) {
            // If no config provided, validate env vars and resolve config from env
            // This will throw an error if required env vars are missing or invalid
            // with steps to fix the issue.
            assertEnvConfigValid();
        }
        const resolved = config ?? resolveConfigFromEnv()!;

        const providers = createProviders(resolved);

        return {
            module: HieroModule,
            providers,
            exports: providers.map((p) =>
                typeof p === "object" && "provide" in p ? p.provide : p,
            ),
            global: opts?.global ?? false,
        };
    }

    /**
     * Register the module asynchronously, allowing config to be injected
     * from other modules (e.g., ConfigModule, vault services).
     */
    static forRootAsync(options: HieroModuleAsyncOptions): DynamicModule {
        const configProvider: Provider = {
            provide: HIERO_CONFIG,
            useFactory: options.useFactory,
            inject: options.inject ?? [],
        };

        const runtimeProvider: Provider = {
            provide: HIERO_RUNTIME,
            useFactory: (config: HieroConfig) => createHieroRuntime(config),
            inject: [HIERO_CONFIG],
        };

        const serviceProviders = createServiceProviders();

        return {
            module: HieroModule,
            imports: options.imports ?? [],
            providers: [configProvider, runtimeProvider, ...serviceProviders],
            exports: [
                HIERO_CONFIG,
                HIERO_CONTEXT,
                MirrorNodeClient,
                AccountService,
                FileService,
                FungibleTokenService,
                NftService,
                SmartContractService,
                TopicService,
                AccountRepository,
                NftRepository,
                TokenRepository,
                TopicRepository,
                TransactionRepository,
                NetworkRepository,
            ],
            global: options.global ?? false,
        };
    }
}

function createProviders(config: HieroConfig): Provider[] {
    const runtime = createHieroRuntime(config);

    return [
        { provide: HIERO_CONFIG, useValue: config },
        { provide: HIERO_RUNTIME, useValue: runtime },
        { provide: HIERO_CONTEXT, useValue: runtime.context },
        { provide: MirrorNodeClient, useValue: runtime.mirrorNodeClient },
        { provide: AccountService, useValue: runtime.accountService },
        { provide: FileService, useValue: runtime.fileService },
        {
            provide: FungibleTokenService,
            useValue: runtime.fungibleTokenService,
        },
        { provide: NftService, useValue: runtime.nftService },
        {
            provide: SmartContractService,
            useValue: runtime.smartContractService,
        },
        { provide: TopicService, useValue: runtime.topicService },
        { provide: AccountRepository, useValue: runtime.accountRepository },
        { provide: NftRepository, useValue: runtime.nftRepository },
        { provide: TokenRepository, useValue: runtime.tokenRepository },
        { provide: TopicRepository, useValue: runtime.topicRepository },
        {
            provide: TransactionRepository,
            useValue: runtime.transactionRepository,
        },
        { provide: NetworkRepository, useValue: runtime.networkRepository },
    ];
}

function createServiceProviders(): Provider[] {
    return [
        {
            provide: HIERO_CONTEXT,
            useFactory: (runtime: HieroRuntime) => runtime.context,
            inject: [HIERO_RUNTIME],
        },
        {
            provide: MirrorNodeClient,
            useFactory: (runtime: HieroRuntime) => runtime.mirrorNodeClient,
            inject: [HIERO_RUNTIME],
        },
        {
            provide: AccountService,
            useFactory: (runtime: HieroRuntime) => runtime.accountService,
            inject: [HIERO_RUNTIME],
        },
        {
            provide: FileService,
            useFactory: (runtime: HieroRuntime) => runtime.fileService,
            inject: [HIERO_RUNTIME],
        },
        {
            provide: FungibleTokenService,
            useFactory: (runtime: HieroRuntime) => runtime.fungibleTokenService,
            inject: [HIERO_RUNTIME],
        },
        {
            provide: NftService,
            useFactory: (runtime: HieroRuntime) => runtime.nftService,
            inject: [HIERO_RUNTIME],
        },
        {
            provide: SmartContractService,
            useFactory: (runtime: HieroRuntime) => runtime.smartContractService,
            inject: [HIERO_RUNTIME],
        },
        {
            provide: TopicService,
            useFactory: (runtime: HieroRuntime) => runtime.topicService,
            inject: [HIERO_RUNTIME],
        },
        {
            provide: AccountRepository,
            useFactory: (runtime: HieroRuntime) => runtime.accountRepository,
            inject: [HIERO_RUNTIME],
        },
        {
            provide: NftRepository,
            useFactory: (runtime: HieroRuntime) => runtime.nftRepository,
            inject: [HIERO_RUNTIME],
        },
        {
            provide: TokenRepository,
            useFactory: (runtime: HieroRuntime) => runtime.tokenRepository,
            inject: [HIERO_RUNTIME],
        },
        {
            provide: TopicRepository,
            useFactory: (runtime: HieroRuntime) => runtime.topicRepository,
            inject: [HIERO_RUNTIME],
        },
        {
            provide: TransactionRepository,
            useFactory: (runtime: HieroRuntime) =>
                runtime.transactionRepository,
            inject: [HIERO_RUNTIME],
        },
        {
            provide: NetworkRepository,
            useFactory: (runtime: HieroRuntime) => runtime.networkRepository,
            inject: [HIERO_RUNTIME],
        },
    ];
}

// Re-export the full public surface of @hiero-enterprise/core.
// Core is bundled into this adapter at publish time (tsup `noExternal`),
// so consumers get a single self-contained package and never need to
// depend on @hiero-enterprise/core directly.
export * from "@hiero-enterprise/core";

// Nest-specific decorator helpers
export { InjectHieroContext, InjectHieroConfig } from "./decorators.js";
