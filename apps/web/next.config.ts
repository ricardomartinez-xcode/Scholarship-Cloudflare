import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "node:path";

const nextConfig: NextConfig = {
  // The build script runs `npm run typecheck` first. Skipping Next's duplicate
  // internal pass avoids local/Vercel OOM in this large monorepo build.
  typescript: {
    ignoreBuildErrors: process.env.NEXT_SKIP_INTERNAL_TYPECHECK === "1",
  },
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: [
    "@relead/ui",
    "@relead/config",
    "@relead/db",
    "@relead/auth",
    "@relead/domain",
    "@relead/realtime",
    "@relead/matricula-sdk",
  ],
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@": path.resolve(process.cwd(), "src"),
      "@relead/matricula-sdk": path.resolve(
        process.cwd(),
        "../../packages/matricula-sdk/src/index.ts",
      ),
      "@relead/matricula-sdk/client": path.resolve(
        process.cwd(),
        "../../packages/matricula-sdk/src/client.ts",
      ),
    };
    return config;
  },
  // Allow Playwright dev-server requests from either 127.0.0.1 or localhost.
  // Next expects origin-like entries; we include both with and without scheme for compatibility.
  allowedDevOrigins: [
    "127.0.0.1:3000",
    "localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
  ],
  images: {
    qualities: [100, 75],
  },
};

const shouldEnableSentryBuildPlugin = Boolean(
  process.env.SENTRY_AUTH_TOKEN &&
    process.env.SENTRY_ORG &&
    process.env.SENTRY_PROJECT,
);

const sentryConfig = shouldEnableSentryBuildPlugin
  ? withSentryConfig(nextConfig, {
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      silent: true,
      sourcemaps: {
        disable: !process.env.SENTRY_AUTH_TOKEN,
      },
    })
  : nextConfig;

export default sentryConfig;
