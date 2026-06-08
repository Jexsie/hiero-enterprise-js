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

// Consumers import types and services directly from @hiero-enterprise/core.
// This adapter only provides the Express middleware integration.
