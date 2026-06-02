import type { Request, Response, NextFunction } from "express";
import type { HieroConfig, HieroServices } from "@hiero-enterprise/core";
import {
    createHieroServices,
    assertEnvConfigValid,
} from "@hiero-enterprise/core";

/**
 * Augment Express Request to include Hiero services.
 */
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            hiero: HieroServices;
        }
    }
}

/**
 * Express middleware that initializes the HieroContext and injects all
 * Hiero services into `req.hiero`.
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { hieroMiddleware } from '@hiero-enterprise/express';
 *
 * const app = express();
 * app.use(hieroMiddleware({ network: 'testnet', operatorId: '0.0.1', operatorKey: '302e...' }));
 *
 * app.get('/balance', async (req, res) => {
 *   const balance = await req.hiero.accountService.getOperatorAccountBalance();
 *   res.json(balance);
 * });
 * ```
 */
export function hieroMiddleware(config?: HieroConfig) {
    if (!config) {
        assertEnvConfigValid();
    }
    const services: HieroServices = createHieroServices(config);

    return (req: Request, _res: Response, next: NextFunction) => {
        req.hiero = services;
        next();
    };
}

// Re-export the full public surface of @hiero-enterprise/core.
// Core is bundled into this adapter at publish time (tsup `noExternal`),
// so consumers get a single self-contained package and never need to
// depend on @hiero-enterprise/core directly.
export * from "@hiero-enterprise/core";
