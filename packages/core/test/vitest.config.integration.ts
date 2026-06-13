import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["test/integration/**/*.spec.ts"],
        testTimeout: 60000,
        hookTimeout: 60000,
        environment: "node",
        setupFiles: ["test/utils/setup-env.ts"],
    },
});
