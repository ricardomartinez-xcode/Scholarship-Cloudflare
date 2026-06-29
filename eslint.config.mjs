import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    files: [
      "scripts/**/*.{js,ts}",
      "prisma/**/*.{js,ts}",
      "src/scripts/**/*.{js,ts}",
      "src/**/import*.*",
      "src/**/seed*.*",
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "**/.next/**",
    "out/**",
    "**/out/**",
    "build/**",
    "**/build/**",
    "dist/**",
    "**/dist/**",
    ".open-next/**",
    "**/.open-next/**",
    ".wrangler/**",
    "**/.wrangler/**",
    ".wrangler-bundle/**",
    "**/.wrangler-bundle/**",
    "apps/chrome-extension/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
