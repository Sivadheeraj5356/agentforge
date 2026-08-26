import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";
import { baseConfig } from "@agentforge/config/eslint/base";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...baseConfig,
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "e2e/**",
      "playwright.config.ts",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
      ".next/**",
    ],
  },
];

export default config;
