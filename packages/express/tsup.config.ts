import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: { resolve: true },
    sourcemap: true,
    clean: true,
    target: "node20",
    // Bundle core into the adapter so consumers do not need
    // to install the private @hiero-enterprise/core package.
    noExternal: ["@hiero-enterprise/core"],
    external: ["express", "@hiero-ledger/sdk"],
});
