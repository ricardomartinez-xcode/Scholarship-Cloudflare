import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

function getR2RemotePattern() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  if (!endpoint) return null;
  try {
    const url = new URL(endpoint);
    return {
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      pathname: "/**",
    };
  } catch {
    return null;
  }
}

const r2RemotePattern = getR2RemotePattern();

const nextConfig: NextConfig = {
  transpilePackages: ["@relead/ui", "@relead/config", "@relead/db", "@relead/auth", "@relead/domain", "@relead/realtime"],
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
    remotePatterns: r2RemotePattern ? [r2RemotePattern] : [],
  },
};

export default withSentryConfig(nextConfig, {
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
