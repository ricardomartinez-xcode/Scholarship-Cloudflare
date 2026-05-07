import "server-only";

import { prisma } from "@/lib/prisma";
import webpush, { type PushSubscription } from "web-push";

export type PushSubscriptionInput = {
  endpoint: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

type PushNotificationPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
  threadId?: string;
};

function getWebPushConfig() {
  const publicKey =
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  const subject =
    process.env.WEB_PUSH_SUBJECT ?? "mailto:recalc@relead.com.mx";

  if (!publicKey || !privateKey) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

export function getWebPushConfigState() {
  const missing: string[] = [];
  const publicKey =
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  const subject =
    process.env.WEB_PUSH_SUBJECT ?? "mailto:recalc@relead.com.mx";

  if (!publicKey) {
    missing.push("NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY or WEB_PUSH_PUBLIC_KEY");
  }
  if (!privateKey) {
    missing.push("WEB_PUSH_PRIVATE_KEY");
  }
  if (!subject) {
    missing.push("WEB_PUSH_SUBJECT");
  }

  return {
    configured: missing.length === 0,
    missing,
    subject,
    publicKeyPresent: Boolean(publicKey),
  };
}

function ensureWebPushConfigured() {
  const config = getWebPushConfig();
  if (!config) {
    throw new Error("Web Push no está configurado.");
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return config;
}

function toDate(value?: number | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeSubscription(input: PushSubscriptionInput) {
  const endpoint = String(input.endpoint ?? "").trim();
  const publicKey = String(input.keys?.p256dh ?? "").trim();
  const authToken = String(input.keys?.auth ?? "").trim();

  if (!endpoint || !publicKey || !authToken) {
    throw new Error("La suscripción del navegador está incompleta.");
  }

  return {
    endpoint,
    publicKey,
    authToken,
    expirationTime: toDate(input.expirationTime),
  };
}

function parseStatusCode(error: unknown) {
  const casted = error as { statusCode?: number; statusCodeText?: string };
  return typeof casted.statusCode === "number" ? casted.statusCode : null;
}

export function getWebPushClientConfig() {
  const config = getWebPushConfig();
  return {
    configured: Boolean(config),
    publicKey: config?.publicKey ?? null,
  };
}

export async function saveUserPushSubscription(
  userId: string,
  subscription: PushSubscriptionInput,
  userAgent?: string | null,
) {
  const normalized = normalizeSubscription(subscription);

  await prisma.userPushSubscription.upsert({
    where: { endpoint: normalized.endpoint },
    update: {
      userId,
      expirationTime: normalized.expirationTime,
      publicKey: normalized.publicKey,
      authToken: normalized.authToken,
      userAgent: userAgent?.trim() || null,
    },
    create: {
      userId,
      endpoint: normalized.endpoint,
      expirationTime: normalized.expirationTime,
      publicKey: normalized.publicKey,
      authToken: normalized.authToken,
      userAgent: userAgent?.trim() || null,
    },
  });
}

export async function deleteUserPushSubscription(
  userId: string,
  endpoint: string,
) {
  const normalizedEndpoint = String(endpoint ?? "").trim();
  if (!normalizedEndpoint) return;

  await prisma.userPushSubscription.deleteMany({
    where: {
      userId,
      endpoint: normalizedEndpoint,
    },
  });
}

export async function sendPushNotificationToUsers(
  userIds: string[],
  payload: PushNotificationPayload,
) {
  if (!userIds.length) {
    return { delivered: 0, removed: 0, skipped: true };
  }

  const config = getWebPushConfig();
  if (!config) {
    return { delivered: 0, removed: 0, skipped: true };
  }

  ensureWebPushConfigured();

  const subscriptions = await prisma.userPushSubscription.findMany({
    where: {
      userId: { in: userIds },
    },
    select: {
      id: true,
      endpoint: true,
      publicKey: true,
      authToken: true,
      expirationTime: true,
    },
  });

  if (!subscriptions.length) {
    return { delivered: 0, removed: 0, skipped: false };
  }

  const serializedPayload = JSON.stringify(payload);
  const staleIds: string[] = [];
  let delivered = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const pushSubscription: PushSubscription = {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime?.getTime() ?? null,
        keys: {
          p256dh: subscription.publicKey,
          auth: subscription.authToken,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, serializedPayload);
        delivered += 1;
      } catch (error) {
        const statusCode = parseStatusCode(error);
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(subscription.id);
          return;
        }

        console.error("Failed to send Web Push notification:", error);
      }
    }),
  );

  if (staleIds.length) {
    await prisma.userPushSubscription.deleteMany({
      where: {
        id: { in: staleIds },
      },
    });
  }

  return {
    delivered,
    removed: staleIds.length,
    skipped: false,
  };
}
