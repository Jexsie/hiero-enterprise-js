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
    ScheduleService,
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

/**
 * Single source of truth: DI class token → HieroRuntime property key.
 * Adding a service to createHieroRuntime in core flows through here
 * automatically
 */
const SERVICE_TOKENS = [
    [MirrorNodeClient, "mirrorNodeClient"],
    [AccountService, "accountService"],
    [ScheduleService, "scheduleService"],
    [FileService, "fileService"],
    [FungibleTokenService, "fungibleTokenService"],
    [NftService, "nftService"],
    [SmartContractService, "smartContractService"],
    [TopicService, "topicService"],
    [AccountRepository, "accountRepository"],
    [NftRepository, "nftRepository"],
    [TokenRepository, "tokenRepository"],
    [TopicRepository, "topicRepository"],
    [TransactionRepository, "transactionRepository"],
    [NetworkRepository, "networkRepository"],
] as const satisfies ReadonlyArray<
    readonly [Type<unknown>, keyof HieroRuntime]
>;

const EXPORTED_TOKENS = [
    HIERO_CONFIG,
    HIERO_CONTEXT,
    ...SERVICE_TOKENS.map(([token]) => token),
];

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

// HieroModule definition

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
        const runtime = createHieroRuntime(resolved);

        const providers: Provider[] = [
            { provide: HIERO_CONFIG, useValue: resolved },
            { provide: HIERO_CONTEXT, useValue: runtime.context },
            ...SERVICE_TOKENS.map(([token, key]) => ({
                provide: token,
                // eslint-disable-next-line security/detect-object-injection -- key is constrained to keyof HieroRuntime
                useValue: runtime[key],
            })),
        ];

        return {
            module: HieroModule,
            providers,
            exports: EXPORTED_TOKENS,
            global: opts?.global ?? false,
        };
    }

    /**
     * Register the module asynchronously, allowing config to be injected
     * from other modules (e.g., ConfigModule, vault services).
     */
    static forRootAsync(options: HieroModuleAsyncOptions): DynamicModule {
        const providers: Provider[] = [
            {
                provide: HIERO_CONFIG,
                useFactory: options.useFactory,
                inject: options.inject ?? [],
            },
            {
                provide: HIERO_RUNTIME,
                useFactory: (config: HieroConfig) => createHieroRuntime(config),
                inject: [HIERO_CONFIG],
            },
            {
                provide: HIERO_CONTEXT,
                useFactory: (runtime: HieroRuntime) => runtime.context,
                inject: [HIERO_RUNTIME],
            },
            ...SERVICE_TOKENS.map(([token, key]) => ({
                provide: token,
                // eslint-disable-next-line security/detect-object-injection -- key is constrained to keyof HieroRuntime
                useFactory: (runtime: HieroRuntime) => runtime[key],
                inject: [HIERO_RUNTIME],
            })),
        ];

        return {
            module: HieroModule,
            imports: options.imports ?? [],
            providers,
            exports: EXPORTED_TOKENS,
            global: options.global ?? false,
        };
    }
}

// Re-export service and repository classes used as NestJS DI tokens.
export {
    MirrorNodeClient,
    AccountService,
    ScheduleService,
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
    AccountType,
    OperatorKeyType,
} from "@hiero-enterprise/core";
export type { HieroConfig, HieroServices } from "@hiero-enterprise/core";

// Nest-specific decorator helpers
export { InjectHieroContext, InjectHieroConfig } from "./decorators.js";
