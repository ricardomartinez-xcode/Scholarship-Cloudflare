import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: [
      { find: "server-only", replacement: path.resolve(__dirname, "./apps/web/tests/vitest/server-only-stub.ts") },
      { find: "@", replacement: path.resolve(__dirname, "./apps/web/src") },
      { find: /^@relead\/ui\/(.+)$/, replacement: `${path.resolve(__dirname, "./packages/ui/src")}/$1` },
      { find: "@relead/ui", replacement: path.resolve(__dirname, "./packages/ui/src/index.ts") },
      { find: /^@relead\/config\/(.+)$/, replacement: `${path.resolve(__dirname, "./packages/config/src")}/$1` },
      { find: "@relead/config", replacement: path.resolve(__dirname, "./packages/config/src/index.ts") },
      { find: /^@relead\/db\/(.+)$/, replacement: `${path.resolve(__dirname, "./packages/db/src")}/$1` },
      { find: "@relead/db", replacement: path.resolve(__dirname, "./packages/db/src/index.ts") },
      { find: /^@relead\/auth\/(.+)$/, replacement: `${path.resolve(__dirname, "./packages/auth/src")}/$1` },
      { find: "@relead/auth", replacement: path.resolve(__dirname, "./packages/auth/src/index.ts") },
      { find: /^@relead\/domain\/(.+)$/, replacement: `${path.resolve(__dirname, "./packages/domain/src")}/$1` },
      { find: "@relead/domain", replacement: path.resolve(__dirname, "./packages/domain/src/index.ts") },
      { find: /^@relead\/realtime\/(.+)$/, replacement: `${path.resolve(__dirname, "./packages/realtime/src")}/$1` },
      { find: "@relead/realtime", replacement: path.resolve(__dirname, "./packages/realtime/src/index.ts") },
    ],
  },
  test: {
    environment: "node",
    include: [
      "apps/web/src/**/*.test.ts",
      "apps/web/src/**/*.spec.ts",
      "packages/**/*.test.ts",
      "packages/**/*.spec.ts",
      "apps/web/src/**/__tests__/**/*.ts",
    ],
    exclude: ["apps/web/tests/e2e/**", "playwright-report/**", "test-results/**"],
  },
});
