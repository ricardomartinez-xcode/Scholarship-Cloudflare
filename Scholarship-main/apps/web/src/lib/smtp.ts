type DkimConfig = {
  domain: string;
  selector: string;
  privateKey: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  /** Raw SMTP_FROM value, e.g. "recalc@relead.com.mx" */
  from: string;
  tls: boolean;
  /** Optional display name, e.g. "ReCalc". When set, From is "ReCalc <recalc@relead.com.mx>" */
  fromName?: string;
  /** Optional Reply-To address */
  replyTo?: string;
  /** Optional DKIM signing. Requires matching DNS TXT record. */
  dkim?: DkimConfig;
};

export type SmtpStatus =
  | { ok: true; config: SmtpConfig }
  | { ok: false; missing: string[]; reason: "missing_vars" | "invalid_port" };

const toBool = (value?: string) => {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
};

export function getSmtpStatus(env = process.env): SmtpStatus {
  const missing = new Set<string>();

  const host = (env.SMTP_HOST ?? "").trim();
  const portRaw = (env.SMTP_PORT ?? "").trim();
  const user = (env.SMTP_USER ?? "").trim();
  const pass = env.SMTP_PASS ?? "";
  const from = (env.SMTP_FROM ?? "").trim();
  const tls = toBool(env.SMTP_TLS ?? "true");

  // Optional fields — never block delivery if missing
  const fromName = (env.SMTP_FROM_NAME ?? "").trim() || undefined;
  const replyTo = (env.SMTP_REPLY_TO ?? "").trim() || undefined;

  // Optional DKIM — all three must be present to enable signing
  const dkimDomain = (env.SMTP_DKIM_DOMAIN ?? "").trim();
  const dkimSelector = (env.SMTP_DKIM_SELECTOR ?? "").trim();
  // Vercel stores multiline secrets as literal \n — convert to real newlines
  const dkimPrivateKeyRaw = (env.SMTP_DKIM_PRIVATE_KEY ?? "").replace(/\\n/g, "\n").trim();
  const dkim: DkimConfig | undefined =
    dkimDomain && dkimSelector && dkimPrivateKeyRaw
      ? { domain: dkimDomain, selector: dkimSelector, privateKey: dkimPrivateKeyRaw }
      : undefined;

  if (!host) missing.add("SMTP_HOST");
  if (!user) missing.add("SMTP_USER");
  if (!pass) missing.add("SMTP_PASS");
  if (!from) missing.add("SMTP_FROM");

  if (!portRaw) {
    missing.add("SMTP_PORT");
    return {
      ok: false,
      missing: Array.from(missing),
      reason: "missing_vars",
    };
  }

  const port = Number(portRaw);
  const portValid = Number.isFinite(port) && port > 0 && port <= 65535;
  if (!portValid) {
    missing.add("SMTP_PORT");
    return {
      ok: false,
      missing: Array.from(missing),
      reason: "invalid_port",
    };
  }

  if (missing.size > 0) {
    return {
      ok: false,
      missing: Array.from(missing),
      reason: "missing_vars",
    };
  }

  return {
    ok: true,
    config: { host, port, user, pass, from, tls, fromName, replyTo, dkim },
  };
}
