import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(__dirname, "..");
const localEnvPath = path.join(rootDir, ".env.local");

function readLocalEnvFile() {
  if (!fs.existsSync(localEnvPath)) return {} as Record<string, string>;

  const file = fs.readFileSync(localEnvPath, "utf8");
  const values: Record<string, string> = {};
  for (const rawLine of file.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) values[key] = value;
  }
  return values;
}

const localEnv = readLocalEnvFile();

function getEnvValue(name: string) {
  return process.env[name] || localEnv[name] || undefined;
}

type Check = {
  label: string;
  command: string;
  args: string[];
  env?: Record<string, string | undefined>;
  required?: boolean;
  enabled?: boolean;
};

function resolveCommand(command: string) {
  if (process.platform !== "win32") return command;
  if (command === "npm") return "npm.cmd";
  if (command === "npx") return "npx.cmd";
  return command;
}

function escapeWindowsArg(value: string) {
  if (!/[\s"]/u.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function hasAnyDatabaseUrl() {
  return Boolean(
    getEnvValue("DIRECT_URL") ||
      getEnvValue("POSTGRES_URL_NON_POOLING") ||
      getEnvValue("DATABASE_URL_UNPOOLED") ||
      getEnvValue("DATABASE_URL"),
  );
}

function hasAuthE2ECredentials() {
  return Boolean(
    getEnvValue("E2E_EMAIL") &&
      getEnvValue("E2E_PASSWORD") &&
      getEnvValue("E2E_ADMIN_EMAIL") &&
      getEnvValue("E2E_ADMIN_PASSWORD"),
  );
}

function runCheck(check: Check) {
  return new Promise<void>((resolve, reject) => {
    const child =
      process.platform === "win32"
        ? spawn(
            "cmd.exe",
            [
              "/d",
              "/s",
              "/c",
              [resolveCommand(check.command), ...check.args.map(escapeWindowsArg)].join(" "),
            ],
            {
              cwd: rootDir,
              stdio: "inherit",
              shell: false,
              env: { ...localEnv, ...process.env, ...check.env },
            },
          )
        : spawn(resolveCommand(check.command), check.args, {
            cwd: rootDir,
            stdio: "inherit",
            shell: false,
            env: { ...localEnv, ...process.env, ...check.env },
          });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${check.label} failed with exit code ${code ?? "unknown"}.`));
    });
    child.on("error", reject);
  });
}

async function main() {
  const docsPath = path.join(rootDir, "docs", "QUALITY_RELEASE_GATES.md");
  if (!fs.existsSync(docsPath)) {
    throw new Error("Missing docs/QUALITY_RELEASE_GATES.md.");
  }

  const checks: Check[] = [
    {
      label: "Prisma generate",
      command: "npx",
      args: ["prisma", "generate", "--schema", "packages/db/prisma/schema.prisma"],
    },
    {
      label: "TypeScript",
      command: "npx",
      args: ["tsc", "--noEmit"],
    },
    {
      label: "Cloudflare Worker bundle",
      command: "npm",
      args: ["run", "build:cloudflare"],
    },
    {
      label: "Next build",
      command: "npm",
      args: ["run", "build"],
    },
    {
      label: "Playwright public release checks",
      command: "npx",
      env: {
        E2E_SERVER_MODE: "prod",
      },
      args: [
        "playwright",
        "test",
        "tests/e2e/smoke.spec.ts",
        "tests/e2e/visual-regression.spec.ts",
      ],
    },
    {
      label: "Neon verification",
      command: "npm",
      args: ["run", "verify:neon"],
      enabled: hasAnyDatabaseUrl(),
    },
  ];

  const requireAuthGate = process.env.RELEASE_REQUIRE_AUTH_E2E === "true";
  if (requireAuthGate && !hasAuthE2ECredentials()) {
    throw new Error(
      "RELEASE_REQUIRE_AUTH_E2E=true but E2E auth credentials are missing.",
    );
  }

  if (hasAuthE2ECredentials()) {
    checks.push({
      label: "Playwright authenticated critical flows",
      command: "npx",
      env: {
        E2E_SERVER_MODE: "prod",
      },
      args: [
        "playwright",
        "test",
        "tests/e2e/admin-import.spec.ts",
        "tests/e2e/admin-ui.spec.ts",
        "tests/e2e/admin-critical.spec.ts",
        "tests/e2e/cost-flow.spec.ts",
      ],
      enabled: true,
      required: requireAuthGate,
    });
  }

  for (const check of checks) {
    if (check.enabled === false) {
      console.info(`[release-gate] skipped optional check: ${check.label}`);
      continue;
    }

    console.info(`[release-gate] running: ${check.label}`);
    try {
      await runCheck(check);
    } catch (error) {
      if (check.required === false) {
        console.warn(
          `[release-gate] optional check failed: ${check.label} :: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        continue;
      }
      throw error;
    }
  }

  console.info("[release-gate] all required checks passed.");
}

main().catch((error) => {
  console.error(
    `[release-gate] failed :: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exit(1);
});
