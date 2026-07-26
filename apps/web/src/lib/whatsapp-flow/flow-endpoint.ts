import { constants, createCipheriv, createDecipheriv, privateDecrypt } from "node:crypto";

export type EncryptedFlowRequest = {
  encrypted_aes_key: string;
  encrypted_flow_data: string;
  initial_vector: string;
};

export type DecryptedFlowRequest = {
  action?: "ping" | "INIT" | "BACK" | "data_exchange" | string;
  screen?: string;
  data?: Record<string, unknown>;
  flow_token?: string;
  version?: string;
};

export class FlowEndpointError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function getPrivateKey(): string {
  const raw = process.env.WHATSAPP_FLOW_PRIVATE_KEY_PEM?.trim();
  if (!raw) throw new FlowEndpointError(500, "flow_private_key_not_configured");
  if (raw.startsWith("-----BEGIN")) return raw.replace(/\\n/g, "\n");
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8").trim();
    if (decoded.startsWith("-----BEGIN")) return decoded;
  } catch {}
  throw new FlowEndpointError(500, "invalid_flow_private_key_format");
}

export function decryptFlowRequest(body: EncryptedFlowRequest) {
  let aesKey: Buffer;
  try {
    aesKey = privateDecrypt(
      { key: getPrivateKey(), padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
      Buffer.from(body.encrypted_aes_key, "base64"),
    );
  } catch (error) {
    if (error instanceof FlowEndpointError) throw error;
    throw new FlowEndpointError(421, "flow_public_key_refresh_required");
  }

  try {
    const iv = Buffer.from(body.initial_vector, "base64");
    const encrypted = Buffer.from(body.encrypted_flow_data, "base64");
    const tag = encrypted.subarray(-16);
    const ciphertext = encrypted.subarray(0, -16);
    const decipher = createDecipheriv("aes-128-gcm", aesKey, iv);
    decipher.setAuthTag(tag);
    const request = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")) as DecryptedFlowRequest;
    return { request, aesKey, iv };
  } catch {
    throw new FlowEndpointError(400, "invalid_encrypted_flow_data");
  }
}

export function responseFor(request: DecryptedFlowRequest) {
  const version = request.version ?? "3.0";
  if (request.action === "ping") return { version, data: { status: "active" } };
  if (request.action === "INIT") return { version, screen: "MAIN_MENU", data: {} };
  if (request.action === "BACK") return { version, screen: request.screen ?? "MAIN_MENU", data: request.data ?? {} };
  if (request.action === "data_exchange") return { version, screen: request.screen ?? "MAIN_MENU", data: request.data ?? {} };
  return { version, data: { acknowledged: true } };
}

export function encryptFlowResponse(response: unknown, aesKey: Buffer, iv: Buffer): string {
  const responseIv = Buffer.from(iv.map((byte) => byte ^ 0xff));
  const cipher = createCipheriv("aes-128-gcm", aesKey, responseIv);
  return Buffer.concat([cipher.update(JSON.stringify(response), "utf8"), cipher.final(), cipher.getAuthTag()]).toString("base64");
}
