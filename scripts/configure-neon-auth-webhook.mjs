#!/usr/bin/env node

const DEFAULT_PROJECT_ID = "jolly-king-13100259";
const DEFAULT_BRANCH_ID = "br-old-mountain-ai239lh2";
const DEFAULT_WEBHOOK_URL =
  "https://recalc.relead.com.mx/api/integrations/neon-auth/webhook";
const DEFAULT_EVENTS = [
  "user.created",
  "organization.invitation.created",
  "organization.invitation.accepted",
  "phone.number.verified",
];

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

function parseEvents() {
  const raw = env("NEON_AUTH_WEBHOOK_EVENTS");
  if (!raw) return DEFAULT_EVENTS;

  return raw
    .split(",")
    .map((event) => event.trim())
    .filter(Boolean);
}

async function main() {
  const apiKey = requireEnv("NEON_API_KEY");
  const projectId = env("NEON_PROJECT_ID", DEFAULT_PROJECT_ID);
  const branchId = env("NEON_BRANCH_ID", DEFAULT_BRANCH_ID);
  const webhookUrl = env("NEON_AUTH_WEBHOOK_URL", DEFAULT_WEBHOOK_URL);
  const enabledEvents = parseEvents();
  const timeoutSeconds = Number(env("NEON_AUTH_WEBHOOK_TIMEOUT_SECONDS", "5"));

  if (!webhookUrl.startsWith("https://")) {
    console.error("NEON_AUTH_WEBHOOK_URL must be an HTTPS URL.");
    process.exit(1);
  }

  if (
    enabledEvents.some((event) => event === "send.otp" || event === "send.magic_link") &&
    !env("NEON_AUTH_WEBHOOK_FORWARD_URL")
  ) {
    console.warn(
      "Warning: send.otp/send.magic_link are delivery events. Configure the deployed route with NEON_AUTH_WEBHOOK_FORWARD_URL or a custom handler before enabling them.",
    );
  }

  const endpoint = `https://console.neon.tech/api/v2/projects/${projectId}/branches/${branchId}/auth/webhooks`;
  const body = {
    enabled: env("NEON_AUTH_WEBHOOK_ENABLED", "true") !== "false",
    webhook_url: webhookUrl,
    enabled_events: enabledEvents,
    timeout_seconds: Number.isFinite(timeoutSeconds) ? timeoutSeconds : 5,
  };

  console.log("Updating Neon Auth webhook config...");
  console.log(
    JSON.stringify(
      {
        projectId,
        branchId,
        webhookUrl,
        enabledEvents,
        timeoutSeconds: body.timeout_seconds,
      },
      null,
      2,
    ),
  );

  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(`Neon API request failed: ${response.status}`);
    console.error(text);
    process.exit(1);
  }

  console.log("Neon Auth webhook updated.");
  if (text) {
    console.log(text);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
