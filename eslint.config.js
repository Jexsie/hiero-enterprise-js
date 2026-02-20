import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig(
    globalIgnores(["**/dist/**", "**/node_modules/**", "**/*.test.ts"]),

    // ─── Base JS rules ──────────────────────────────────────────
    eslint.configs.recommended,

    // ─── TypeScript rules ───────────────────────────────────────
    ...tseslint.configs.recommended,

    // ─── Prettier (disables conflicting rules) ──────────────────
    prettierConfig,

    // ─── Prettier plugin (reports formatting as errors) ─────────
    {
        plugins: { prettier: prettierPlugin },
        rules: {
            "prettier/prettier": "error",
        },
    },

    // ─── Project-specific rules ─────────────────────────────────
    {
        files: ["**/*.{js,ts}"],
        rules: {
            // Allow unused vars when prefixed with _
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],

            // Allow explicit `any` in specific patterns (options objects, SDK interop)
            "@typescript-eslint/no-explicit-any": "error",

            // Allow non-null assertions (common pattern with SDK receipts)
            "@typescript-eslint/no-non-null-assertion": "off",

            // Allow empty interfaces / object types (used for extensibility)
            "@typescript-eslint/no-empty-object-type": "off",

            // Prefer `import type` for type-only imports
            "@typescript-eslint/consistent-type-imports": [
                "warn",
                { prefer: "type-imports", fixStyle: "separate-type-imports" },
            ],
        },
    },
);
