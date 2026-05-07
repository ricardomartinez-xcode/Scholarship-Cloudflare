import { createHash, randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { normalizeContactPhone } from "@/lib/user-contacts";

const FALLBACK_GRAPH_VERSION = process.env.META_GRAPH_API_VERSION?.trim() || "v25.0";
const DEFAULT_ACTION_SOURCE = "business_messaging";
const DEFAULT_MESSAGING_CHANNEL = "whatsapp";

type GraphResponseError = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

export type MetaConversionsRequestBody = {
  data: Array<{
    event_name: string;
    event_time: number;
    event_id: string;
    action_source: typeof DEFAULT_ACTION_SOURCE;
    messaging_channel: typeof DEFAULT_MESSAGING_CHANNEL;
    user_data: {
      external_id: string[];
      ph?: string[];
      em?: string[];
      client_ip_address?: string;
      client_user_agent?: string;
    };
    custom_data?: {
      currency?: string;
      value?: number;
    };
    event_source_url?: string;
  }>;
  test_event_code?: string;
};

type SendMetaBusinessMessagingConversionParams = {
  userId: string;
  contactId: string;
  eventName: string;
  value?: number | null;
  currency?: string | null;
  eventSourceUrl?: string | null;
  sourceMessageId?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
};

function getMetaConversionsEnv() {
  return {
    datasetId: process.env.META_CONVERSIONS_DATASET_ID?.trim() ?? "",
    accessToken: process.env.META_CONVERSIONS_ACCESS_TOKEN?.trim() ?? "",
    graphApiVersion: process.env.META_GRAPH_API_VERSION?.trim() ?? FALLBACK_GRAPH_VERSION,
    testEventCode: process.env.META_CONVERSIONS_TEST_EVENT_CODE?.trim() ?? "",
  };
}

function metaGraphUrl(path: string, graphApiVersion = FALLBACK_GRAPH_VERSION) {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `https://graph.facebook.com/${graphApiVersion}/${normalizedPath}`;
}

function formatGraphError(status: number, payload: GraphResponseError | unknown) {
  const casted = payload as GraphResponseError | null;
  const message = casted?.error?.message ?? JSON.stringify(payload ?? {});
  return `Meta Graph error (${status}): ${String(message).slice(0, 400)}`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmailForConversions(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || null;
}

export function normalizePhoneForConversions(value: string | null | undefined) {
  const normalized = normalizeContactPhone(value ?? "");
  const digitsOnly = normalized.replace(/\D+/g, "");
  return digitsOnly || null;
}

function buildUserData(params: {
  contact: {
    id: string;
    normalizedPhone: string;
    email: string | null;
    waId: string | null;
    bsuid: string | null;
  };
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
}) {
  const externalIds = Array.from(
    new Set(
      [params.contact.id, params.contact.waId, params.contact.bsuid]
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .map((item) => sha256(item)),
    ),
  );

  const phone = normalizePhoneForConversions(params.contact.normalizedPhone);
  const email = normalizeEmailForConversions(params.contact.email);

  return {
    external_id: externalIds,
    ...(phone ? { ph: [sha256(phone)] } : {}),
    ...(email ? { em: [sha256(email)] } : {}),
    ...(params.clientIpAddress ? { client_ip_address: params.clientIpAddress } : {}),
    ...(params.clientUserAgent ? { client_user_agent: params.clientUserAgent } : {}),
  };
}

function sanitizeCurrency(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) return null;
  return normalized.slice(0, 3);
}

function toInputJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function sanitizeEventName(value: string) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    throw new Error("The Conversions API event name is required.");
  }
  return normalized;
}

function sanitizeValue(value: number | null | undefined) {
  if (value == null) return null;
  if (!Number.isFinite(value)) {
    throw new Error("The Conversions API value must be numeric.");
  }
  return Number(value);
}

export function buildMetaConversionsRequestBody(params: {
  eventName: string;
  userData: {
    external_id: string[];
    ph?: string[];
    em?: string[];
    client_ip_address?: string;
    client_user_agent?: string;
  };
  value?: number | null;
  currency?: string | null;
  eventSourceUrl?: string | null;
  testEventCode?: string | null;
}) {
  const eventName = sanitizeEventName(params.eventName);
  const value = sanitizeValue(params.value);
  const currency = sanitizeCurrency(params.currency);
  const eventId = randomUUID();

  return {
    eventId,
    body: {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          action_source: DEFAULT_ACTION_SOURCE,
          messaging_channel: DEFAULT_MESSAGING_CHANNEL,
          user_data: params.userData,
          ...(value != null || currency
            ? {
                custom_data: {
                  ...(currency ? { currency } : {}),
                  ...(value != null ? { value } : {}),
                },
              }
            : {}),
          ...(params.eventSourceUrl?.trim()
            ? { event_source_url: params.eventSourceUrl.trim() }
            : {}),
        },
      ],
      ...(params.testEventCode?.trim()
        ? { test_event_code: params.testEventCode.trim() }
        : {}),
    } satisfies MetaConversionsRequestBody,
  };
}

function buildAuditEventType(prefix: "sent" | "failed", eventName: string) {
  const compactName = eventName.trim().replace(/\s+/g, "_").slice(0, 48);
  return `conversion_api_${prefix}:${compactName || "unnamed"}`;
}

export async function sendMetaBusinessMessagingConversion(
  params: SendMetaBusinessMessagingConversionParams,
) {
  const env = getMetaConversionsEnv();
  if (!env.datasetId || !env.accessToken) {
    throw new Error(
      "META_CONVERSIONS_DATASET_ID and META_CONVERSIONS_ACCESS_TOKEN are required for Conversions API.",
    );
  }

  const [connection, contact, sourceMessage] = await Promise.all([
    prisma.userMetaWhatsappConnection.findUnique({
      where: { userId: params.userId },
    }),
    prisma.userContact.findFirst({
      where: {
        id: params.contactId,
        ownerUserId: params.userId,
      },
    }),
    params.sourceMessageId
      ? prisma.metaWhatsappMessage.findFirst({
          where: {
            id: params.sourceMessageId,
            ownerUserId: params.userId,
          },
        })
      : Promise.resolve(null),
  ]);

  if (!connection) {
    throw new Error("No WABA connection exists for this user yet.");
  }

  if (!contact) {
    throw new Error("The selected contact could not be found for this user.");
  }

  const { eventId, body } = buildMetaConversionsRequestBody({
    eventName: params.eventName,
    userData: buildUserData({
      contact: {
        id: contact.id,
        normalizedPhone: contact.normalizedPhone,
        email: contact.email,
        waId: contact.waId,
        bsuid: contact.bsuid,
      },
      clientIpAddress: params.clientIpAddress,
      clientUserAgent: params.clientUserAgent,
    }),
    value: params.value,
    currency: params.currency,
    eventSourceUrl: params.eventSourceUrl,
    testEventCode: env.testEventCode,
  });

  const response = await fetch(metaGraphUrl(`${env.datasetId}/events`, env.graphApiVersion), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const responsePayload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (!response.ok) {
    const errorMessage = formatGraphError(response.status, responsePayload);

    await prisma.metaWhatsappMessageEvent.create({
      data: {
        ownerUserId: params.userId,
        connectionId: connection.id,
        contactId: contact.id,
        messageId: sourceMessage?.id ?? null,
        metaMessageId: sourceMessage?.metaMessageId ?? null,
        eventType: buildAuditEventType("failed", params.eventName),
        deliveryStatus: "failed",
        payload: toInputJson({
          datasetId: env.datasetId,
          eventId,
          request: body,
          response: responsePayload,
          error: errorMessage,
        }),
        eventAt: new Date(),
      },
    });

    throw new Error(errorMessage);
  }

  await prisma.metaWhatsappMessageEvent.create({
    data: {
      ownerUserId: params.userId,
      connectionId: connection.id,
      contactId: contact.id,
      messageId: sourceMessage?.id ?? null,
      metaMessageId: sourceMessage?.metaMessageId ?? null,
      eventType: buildAuditEventType("sent", params.eventName),
      deliveryStatus: "accepted",
      payload: toInputJson({
        datasetId: env.datasetId,
        eventId,
        request: body,
        response: responsePayload,
      }),
      eventAt: new Date(),
    },
  });

  return {
    eventId,
    datasetId: env.datasetId,
    response: responsePayload,
  };
}
