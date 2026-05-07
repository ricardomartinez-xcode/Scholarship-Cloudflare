import nodemailer from "nodemailer";

import { getSmtpStatus } from "@/lib/smtp";

/**
 * Formats a From address as "Name <email>" when a display name is provided.
 * If the raw `from` already contains angle brackets (e.g. set by the operator),
 * it is returned as-is.
 */
function buildFromAddress(from: string, fromName?: string): string {
  if (!fromName) return from;
  if (from.includes("<")) return from; // already formatted
  return `${fromName} <${from}>`;
}

export async function sendMail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const status = getSmtpStatus();
  if (!status.ok) {
    if (status.reason === "invalid_port") {
      throw new Error("SMTP_PORT debe ser un puerto válido (1-65535).");
    }
    throw new Error("Falta configurar SMTP para enviar correos.");
  }

  const { host, port, user, pass, from, tls, fromName, replyTo, dkim } = status.config;

  const secure = port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: tls,
    auth: { user, pass },
    // DKIM signing — only active when SMTP_DKIM_* vars are configured
    ...(dkim
      ? {
          dkim: {
            domainName: dkim.domain,
            keySelector: dkim.selector,
            privateKey: dkim.privateKey,
          },
        }
      : {}),
  });

  const formattedFrom = buildFromAddress(from, fromName);

  await transporter.sendMail({
    from: formattedFrom,
    replyTo: replyTo ?? formattedFrom,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    headers: {
      "Precedence": "transactional",
      "Auto-Submitted": "auto-generated",
      "X-Priority": "3",
      "X-Mailer": "ReCalc/1.0",
    },
  });
}
