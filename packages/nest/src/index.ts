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
    HieroContext,
    resolveConfigFromEnv,
    resolveMirrorNodeUrl,
    assertEnvConfigValid,
    MirrorNodeClient,
    AccountClient,
    FileClient,
    FungibleTokenClient,
    NftClient,
    SmartContractClient,
    TopicClient,
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
    static forRoot(config?: HieroConfig): DynamicModule {
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
            global: true,
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

        const contextProvider: Provider = {
            provide: HIERO_CONTEXT,
            useFactory: (config: HieroConfig) => new HieroContext(config),
            inject: [HIERO_CONFIG],
        };

        const mirrorNodeProvider: Provider = {
            provide: MirrorNodeClient,
            useFactory: (context: HieroContext) => {
                const mirrorNodeUrl = resolveMirrorNodeUrl(
                    context.config.network,
                    context.config.mirrorNodeUrl,
                );
                return new MirrorNodeClient(mirrorNodeUrl, {
                    timeoutMs: context.config.mirrorNodeTimeoutMs,
                    maxRetries: context.config.mirrorNodeMaxRetries,
                });
            },
            inject: [HIERO_CONTEXT],
        };

        const serviceProviders = createServiceProviders();

        return {
            module: HieroModule,
            imports: options.imports ?? [],
            providers: [
                configProvider,
                contextProvider,
                mirrorNodeProvider,
                ...serviceProviders,
            ],
            exports: [
                HIERO_CONFIG,
                HIERO_CONTEXT,
                MirrorNodeClient,
                AccountClient,
                FileClient,
                FungibleTokenClient,
                NftClient,
                SmartContractClient,
                TopicClient,
                AccountRepository,
                NftRepository,
                TokenRepository,
                TopicRepository,
                TransactionRepository,
                NetworkRepository,
            ],
            global: true,
        };
    }
}

function createProviders(config: HieroConfig): Provider[] {
    const context = new HieroContext(config);
    const mirrorNodeUrl = resolveMirrorNodeUrl(
        context.config.network,
        context.config.mirrorNodeUrl,
    );
    const mirrorNodeClient = new MirrorNodeClient(mirrorNodeUrl, {
        timeoutMs: config.mirrorNodeTimeoutMs,
        maxRetries: config.mirrorNodeMaxRetries,
    });

    return [
        { provide: HIERO_CONFIG, useValue: config },
        { provide: HIERO_CONTEXT, useValue: context },
        { provide: MirrorNodeClient, useValue: mirrorNodeClient },
        { provide: AccountClient, useValue: new AccountClient(context) },
        { provide: FileClient, useValue: new FileClient(context) },
        {
            provide: FungibleTokenClient,
            useValue: new FungibleTokenClient(context),
        },
        { provide: NftClient, useValue: new NftClient(context) },
        {
            provide: SmartContractClient,
            useValue: new SmartContractClient(context),
        },
        { provide: TopicClient, useValue: new TopicClient(context) },
        {
            provide: AccountRepository,
            useValue: new AccountRepository(mirrorNodeClient),
        },
        {
            provide: NftRepository,
            useValue: new NftRepository(mirrorNodeClient),
        },
        {
            provide: TokenRepository,
            useValue: new TokenRepository(mirrorNodeClient),
        },
        {
            provide: TopicRepository,
            useValue: new TopicRepository(mirrorNodeClient),
        },
        {
            provide: TransactionRepository,
            useValue: new TransactionRepository(mirrorNodeClient),
        },
        {
            provide: NetworkRepository,
            useValue: new NetworkRepository(mirrorNodeClient),
        },
    ];
}

function createServiceProviders(): Provider[] {
    return [
        {
            provide: AccountClient,
            useFactory: (ctx: HieroContext) => new AccountClient(ctx),
            inject: [HIERO_CONTEXT],
        },
        {
            provide: FileClient,
            useFactory: (ctx: HieroContext) => new FileClient(ctx),
            inject: [HIERO_CONTEXT],
        },
        {
            provide: FungibleTokenClient,
            useFactory: (ctx: HieroContext) => new FungibleTokenClient(ctx),
            inject: [HIERO_CONTEXT],
        },
        {
            provide: NftClient,
            useFactory: (ctx: HieroContext) => new NftClient(ctx),
            inject: [HIERO_CONTEXT],
        },
        {
            provide: SmartContractClient,
            useFactory: (ctx: HieroContext) => new SmartContractClient(ctx),
            inject: [HIERO_CONTEXT],
        },
        {
            provide: TopicClient,
            useFactory: (ctx: HieroContext) => new TopicClient(ctx),
            inject: [HIERO_CONTEXT],
        },
        {
            provide: AccountRepository,
            useFactory: (mn: MirrorNodeClient) => new AccountRepository(mn),
            inject: [MirrorNodeClient],
        },
        {
            provide: NftRepository,
            useFactory: (mn: MirrorNodeClient) => new NftRepository(mn),
            inject: [MirrorNodeClient],
        },
        {
            provide: TokenRepository,
            useFactory: (mn: MirrorNodeClient) => new TokenRepository(mn),
            inject: [MirrorNodeClient],
        },
        {
            provide: TopicRepository,
            useFactory: (mn: MirrorNodeClient) => new TopicRepository(mn),
            inject: [MirrorNodeClient],
        },
        {
            provide: TransactionRepository,
            useFactory: (mn: MirrorNodeClient) => new TransactionRepository(mn),
            inject: [MirrorNodeClient],
        },
        {
            provide: NetworkRepository,
            useFactory: (mn: MirrorNodeClient) => new NetworkRepository(mn),
            inject: [MirrorNodeClient],
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
