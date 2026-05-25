import { Inject } from "@nestjs/common";
import { HIERO_CONFIG, HIERO_CONTEXT } from "./index.js";

/**
 * Inject the HieroContext instance.
 */
export const InjectHieroContext = () => Inject(HIERO_CONTEXT);

/**
 * Inject the HieroConfig.
 */
export const InjectHieroConfig = () => Inject(HIERO_CONFIG);
