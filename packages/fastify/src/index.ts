import fp from "fastify-plugin";
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { HieroConfig, HieroServices } from "@hiero-enterprise/core";
import {
    createHieroRuntime,
    assertEnvConfigValid,
} from "@hiero-enterprise/core";

/**
 * Augment Fastify instance to include Hiero services.
 */
declare module "fastify" {
    interface FastifyInstance {
        hiero: HieroServices;
    }
}

/**
 * Plugin options — accepts a HieroConfig or reads from environment.
 */
export interface HieroPluginOptions extends FastifyPluginOptions {
    config?: HieroConfig;
}

/**
 * Fastify plugin that initializes the HieroContext and decorates the
 * Fastify instance with all Hiero services at `fastify.hiero`.
 *
 * @example
 * ```ts
 * import Fastify from 'fastify';
 * import { hieroPlugin } from '@hiero-enterprise/fastify';
 *
 * const app = Fastify();
 * app.register(hieroPlugin, { config: { network: 'testnet', operatorId: '0.0.1', operatorKey: '302e...' } });
 *
 * app.get('/balance', async (request, reply) => {
 *   const balance = await app.hiero.accountService.getOperatorAccountBalance();
 *   return balance;
 * });
 * ```
 */
const plugin = async function (
    fastify: FastifyInstance,
    opts: HieroPluginOptions,
): Promise<void> {
    if (!opts.config) {
        assertEnvConfigValid();
    }
    const runtime = createHieroRuntime(opts.config);
    const services: HieroServices = runtime;

    fastify.decorate("hiero", services);

    // Clean up SDK client on close
    fastify.addHook("onClose", () => {
        runtime.close();
    });
};

export const hieroPlugin = fp(plugin, {
    name: "@hiero-enterprise/fastify",
});

// Re-export the full public surface of @hiero-enterprise/core.
// Core is bundled into this adapter at publish time (tsup `noExternal`),
// so consumers get a single self-contained package and never need to
// depend on @hiero-enterprise/core directly.
export * from "@hiero-enterprise/core";
