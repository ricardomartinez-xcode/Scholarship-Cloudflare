import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

const LEGACY_KEY = "abc123abc123abc123abc123abc123ab";
const LEGACY_IV = "a1b2c3d4e5f6g7h8";

const FULL_ACCESS_ID = "RECALC-FULL-ACCESS";
const FULL_ACCESS_REMAINING_DAYS = 36500;
const FULL_ACCESS_ALLOWED_DEVICES = 999;

export type LegacyPayload = Record<string, unknown>;

export function decryptLegacyPayload(encData: string | null | undefined): LegacyPayload {
  if (!encData) return {};

  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      Buffer.from(LEGACY_KEY, "utf8"),
      Buffer.from(LEGACY_IV, "utf8"),
    );

    const decrypted = Buffer.concat([
      decipher.update(encData, "base64"),
      decipher.final(),
    ]).toString("utf8");

    return JSON.parse(decrypted) as LegacyPayload;
  } catch (error) {
    console.error("[premium-sender-legacy] decrypt failed", error);
    return {};
  }
}

export function encryptLegacyPayload(payload: unknown): string {
  const json = typeof payload === "string" ? payload : JSON.stringify(payload);
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(LEGACY_KEY, "utf8"),
    Buffer.from(LEGACY_IV, "utf8"),
  );

  return Buffer.concat([cipher.update(json, "utf8"), cipher.final()]).toString("base64");
}

export async function readLegacyRequest(request: NextRequest): Promise<LegacyPayload> {
  const contentType = request.headers.get("content-type") ?? "";

  if (request.method === "GET") {
    return Object.fromEntries(request.nextUrl.searchParams.entries());
  }

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    if (body?.encData) return decryptLegacyPayload(String(body.encData));
    return body;
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) return {};
  const encData = formData.get("encData");
  if (typeof encData === "string") return decryptLegacyPayload(encData);

  const payload: LegacyPayload = {};
  for (const [key, value] of formData.entries()) {
    payload[key] = typeof value === "string" ? value : value.name;
  }
  return payload;
}

export function encryptedJson(payload: unknown, init?: ResponseInit) {
  return NextResponse.json({ data: encryptLegacyPayload(payload) }, withCors(init));
}

export function legacyJson(payload: unknown, init?: ResponseInit) {
  return NextResponse.json(payload, withCors(init));
}

export function optionsResponse() {
  return new NextResponse(null, withCors({ status: 204 }));
}

export function withCors(init: ResponseInit = {}): ResponseInit {
  const headers = new Headers(init.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  headers.set("Cache-Control", "no-store");

  return { ...init, headers };
}

export function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/**
 * Legacy contract adapter.
 *
 * The original extension calls `/mv3/get-license.php` and expects a payload shaped
 * like a license response. The new ReCalc version intentionally removes license
 * enforcement, so this function returns a synthetic full-access entitlement while
 * preserving the legacy field names required by the bundled extension code.
 */
export function buildLegacyLicense(payload: LegacyPayload) {
  const deviceCode = asString(payload.device_code, asString(payload.deviceid, "legacy-device"));
  const deviceName = asString(payload.device_name, "Premium Sender Device");
  const mobile = asString(payload.mobile, "");

  return {
    status: "success",
    identifier: "OK",
    message: "Full access enabled",
    data: {
      id: FULL_ACCESS_ID,
      license: FULL_ACCESS_ID,
      license_key: FULL_ACCESS_ID,
      entitlement: "full_access",
      license_required: false,
      monetization: "future",
      device_code: deviceCode,
      device_name: deviceName,
      mobile,
      name: deviceName,
      img: null,
      plan: "ReCalc Full Access",
      remainingdays: Number(process.env.PREMIUM_SENDER_FULL_ACCESS_DAYS ?? FULL_ACCESS_REMAINING_DAYS),
      expires_at: null,
      all_devices: [deviceCode],
      allowed_devices: Number(process.env.PREMIUM_SENDER_FULL_ACCESS_DEVICES ?? FULL_ACCESS_ALLOWED_DEVICES),
      whatsapp_connected: false,
      templates: [],
      set: 7.77,
      server: "recalc",
      features: {
        bulk_send: true,
        attachments: true,
        labels: true,
        downloads: true,
        templates: true,
        ai_rewrite: true,
        dom_selectors: true,
      },
    },
  };
}

export const DEFAULT_DOM_SELECTORS = {
  ChatInput: '[contenteditable="true"][data-tab]',
  SendButton: 'span[data-icon="send"]',
  SearchInput: '[contenteditable="true"][data-tab="3"]',
  ChatList: '[role="grid"]',
  MessageRows: '[data-testid="msg-container"], .message-in, .message-out',
  AttachmentButton: 'span[data-icon="clip"], div[title="Attach"]',
  FileInput: 'input[type="file"]',
  DownloadButton: 'span[data-icon="download"]',
  ProfileName: "header span[title]",
};
