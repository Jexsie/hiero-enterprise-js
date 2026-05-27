import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: { resolve: true },
    sourcemap: true,
    clean: true,
    target: "node20",
    noExternal: ["@hiero-enterprise/core"],
    external: [
        "@nestjs/common",
        "@nestjs/core",
        "reflect-metadata",
        "@hiero-ledger/sdk",
    ],
});
