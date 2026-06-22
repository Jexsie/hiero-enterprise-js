import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["test/integration/**/*.ts"],
        testTimeout: 120000,
        hookTimeout: 120000,
        environment: "node",
        setupFiles: ["test/utils/setup-env.ts"],
        coverage: {
            provider: "v8",
            reporter: ["lcov", "text-summary"],
            reportsDirectory: "./coverage/integration",
            include: ["src/**/*.ts"],
            exclude: ["src/**/index.ts", "src/**/*.d.ts", "src/types/**"],

            // No thresholds for integration runs — they exercise happy-path
            // network flows and aren't expected to cover every branch in
            // isolation. Codecov merges unit + integration coverage and the
            // unit config in `vitest.config.ts` enforces the project-wide
            // thresholds (80/70/80/80).
        },
    },
});
