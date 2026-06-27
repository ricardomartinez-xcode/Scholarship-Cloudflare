import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "node:path";

function getR2ImageHostname() {
  const endpoint = process.env.R2_ENDPOINT;
  if (endpoint) {
    try {
      return new URL(endpoint).hostname;
    } catch {
      return null;
    }
  }
  const accountId = process.env.R2_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID;
  return accountId ? `${accountId}.r2.cloudflarestorage.com` : null;
}

const r2ImageHostname = getR2ImageHostname();
const isCloudflareBuild = process.env.CLOUDFLARE_BUILD === "1";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(process.cwd(), "../.."),
  transpilePackages: [
    "@relead/ui",
    "@relead/config",
    "@relead/db",
    "@relead/auth",
    "@relead/domain",
    "@relead/realtime",
    "@relead/matricula-sdk",
    ...(isCloudflareBuild ? ["@prisma/client"] : []),
  ],
  webpack(config, { isServer }) {
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

    if (isCloudflareBuild) {
      config.resolve.alias = {
        ...(config.resolve.alias ?? {}),
        "@prisma/client": path.resolve(
          process.cwd(),
          "src/lib/cloudflare/shims/prisma-client.ts",
        ),
        "@neondatabase/auth/next/server": path.resolve(
          process.cwd(),
          "src/lib/cloudflare/shims/neon-auth-server.ts",
        ),
        ...(isServer
          ? {
              "@supabase/supabase-js": path.resolve(
                process.cwd(),
                "src/lib/cloudflare/shims/supabase.ts",
              ),
            }
          : {}),
        "exceljs$": path.resolve(
          process.cwd(),
          "../../node_modules/exceljs/dist/exceljs.bare.min.js",
        ),
        "@sentry/nextjs": path.resolve(
          process.cwd(),
          "src/lib/cloudflare/shims/sentry-next.ts",
        ),
        "@/lib/prisma": path.resolve(process.cwd(), "src/lib/cloudflare/prisma.ts"),
      };
    }
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
    remotePatterns: r2ImageHostname
      ? [
          {
            protocol: "https",
            hostname: r2ImageHostname,
          },
        ]
      : [],
  },
};

const sentryConfig = withSentryConfig(nextConfig, {
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});

export default isCloudflareBuild ? nextConfig : sentryConfig;
