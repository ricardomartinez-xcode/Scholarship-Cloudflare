#!/usr/bin/env node

const DEFAULT_PROJECT_ID = "jolly-king-13100259";
const DEFAULT_BRANCH_ID = "br-old-mountain-ai239lh2";
const ALLOWED_PROVIDERS = new Set(["google", "github", "microsoft", "vercel"]);

function env(name, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function requireEnv(name) {
  const value = env(name);
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function redactSecrets(value) {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      /secret|token|key/i.test(key) && typeof entry === "string" ? "********" : redactSecrets(entry),
    ]),
  );
}

function parseJsonOrText(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function printNeonFailure(status, payload) {
  console.error(`Neon API request failed: ${status}`);
  console.error(JSON.stringify(redactSecrets(payload), null, 2));
}

function isMissingOAuthProvider(status, payload) {
  if (status === 404) return true;
  const message = JSON.stringify(payload).toLowerCase();
  return message.includes("not found") || message.includes("does not exist");
}

async function requestNeon(path, init = {}, options = {}) {
  const apiKey = requireEnv("NEON_API_KEY");
  const response = await fetch(`https://console.neon.tech/api/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const payload = parseJsonOrText(text);

  if (!response.ok) {
    if (options.allowFailure) return { ok: false, status: response.status, payload };
    printNeonFailure(response.status, payload ?? text);
    process.exit(1);
  }

  return { ok: true, status: response.status, payload };
}

async function listProviders(projectId, branchId) {
  const result = await requestNeon(
    `/projects/${projectId}/branches/${branchId}/auth/oauth_providers`,
  );

  console.log(JSON.stringify(redactSecrets(result.payload), null, 2));
}

async function updateProvider(projectId, branchId, provider) {
  if (!ALLOWED_PROVIDERS.has(provider)) {
    console.error(
      `Invalid provider "${provider}". Use one of: ${Array.from(ALLOWED_PROVIDERS).join(", ")}`,
    );
    process.exit(1);
  }

  const update = {};
  const clientId = env("NEON_AUTH_OAUTH_CLIENT_ID");
  const clientSecret = env("NEON_AUTH_OAUTH_CLIENT_SECRET");
  const microsoftTenantId = env("NEON_AUTH_MICROSOFT_TENANT_ID");

  if (clientId) update.client_id = clientId;
  if (clientSecret) update.client_secret = clientSecret;
  if (microsoftTenantId) update.microsoft_tenant_id = microsoftTenantId;

  if (Object.keys(update).length === 0) {
    console.error(
      "Nothing to update. Set NEON_AUTH_OAUTH_CLIENT_ID, NEON_AUTH_OAUTH_CLIENT_SECRET, or NEON_AUTH_MICROSOFT_TENANT_ID.",
    );
    process.exit(1);
  }

  const providersPath = `/projects/${projectId}/branches/${branchId}/auth/oauth_providers`;
  let result = await requestNeon(
    `${providersPath}/${provider}`,
    {
      method: "PATCH",
      body: JSON.stringify(update),
    },
    { allowFailure: true },
  );

  let action = "updated";
  if (!result.ok) {
    if (!isMissingOAuthProvider(result.status, result.payload)) {
      printNeonFailure(result.status, result.payload);
      process.exit(1);
    }

    result = await requestNeon(
      providersPath,
      {
        method: "POST",
        body: JSON.stringify({ id: provider, ...update }),
      },
    );
    action = "created";
  }

  console.log(`OAuth provider "${provider}" ${action}.`);
  console.log(JSON.stringify(redactSecrets(result.payload), null, 2));
}

async function main() {
  const projectId = env("NEON_PROJECT_ID", DEFAULT_PROJECT_ID);
  const branchId = env("NEON_BRANCH_ID", DEFAULT_BRANCH_ID);
  const provider = env("NEON_AUTH_OAUTH_PROVIDER").toLowerCase();

  if (!provider) {
    console.log("Listing Neon Auth OAuth providers...");
    await listProviders(projectId, branchId);
    return;
  }

  await updateProvider(projectId, branchId, provider);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
