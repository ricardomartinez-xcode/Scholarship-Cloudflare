import "server-only";

type NeonAuthRecentEvent = {
  id: string;
  event: string;
  receivedAt: string;
  forwarded: boolean;
  ok: boolean;
  userId?: string | null;
  email?: string | null;
  error?: string | null;
};

type NeonAuthEventStore = {
  events: NeonAuthRecentEvent[];
};

const globalForNeonAuthEvents = globalThis as typeof globalThis & {
  __recalcNeonAuthEvents?: NeonAuthEventStore;
};

const store =
  globalForNeonAuthEvents.__recalcNeonAuthEvents ??
  (globalForNeonAuthEvents.__recalcNeonAuthEvents = { events: [] });

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractUserId(payload: Record<string, unknown>) {
  const user = payload.user as Record<string, unknown> | undefined;
  const data = payload.data as Record<string, unknown> | undefined;
  return textValue(payload.userId) ?? textValue(payload.user_id) ?? textValue(user?.id) ?? textValue(data?.id);
}

function extractEmail(payload: Record<string, unknown>) {
  const user = payload.user as Record<string, unknown> | undefined;
  const data = payload.data as Record<string, unknown> | undefined;
  return textValue(payload.email) ?? textValue(user?.email) ?? textValue(data?.email);
}

export function recordNeonAuthEvent({
  event,
  payload,
  forwarded,
  ok,
  error = null,
}: {
  event: string;
  payload: Record<string, unknown>;
  forwarded: boolean;
  ok: boolean;
  error?: string | null;
}) {
  store.events.unshift({
    id: crypto.randomUUID(),
    event,
    receivedAt: new Date().toISOString(),
    forwarded,
    ok,
    userId: extractUserId(payload),
    email: extractEmail(payload),
    error,
  });

  store.events = store.events.slice(0, 50);
}

export function getRecentNeonAuthEvents() {
  return store.events.slice(0, 25);
}
