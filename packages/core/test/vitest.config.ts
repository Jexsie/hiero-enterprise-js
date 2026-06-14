import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["test/unit/**/*.test.ts"],
        environment: "node",
        coverage: {
            provider: "v8",
            reporter: ["lcov", "text-summary"],
            reportsDirectory: "./coverage/node",
            include: ["src/**/*.ts"],
            exclude: [
                "src/**/index.ts",
                "src/**/*.d.ts",
                "src/testing/**",
                "src/types/**",
            ],
            thresholds: {
                lines: 80,
                branches: 70,
                functions: 80,
                statements: 80,
            },
        },
    },
});
