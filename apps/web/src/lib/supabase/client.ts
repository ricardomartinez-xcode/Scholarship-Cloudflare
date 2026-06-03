/**
 * Supabase Realtime client utilities.
 *
 * The source of truth for auth and persistence remains Neon + Prisma.
 * Supabase is used only as the transport layer for Broadcast and Presence.
 */

import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

type ScopedRealtimeClient = ReturnType<typeof createClient>;

type BroadcastSubscriptionOptions<TPayload> = {
  topic: string;
  event: string;
  onMessage: (payload: TPayload) => void;
};

export type PresenceUserState = {
  userId: string;
  displayName: string;
  accessRole?: string;
  isAnonymous?: boolean;
  anonymousAlias?: string;
  status?: "online";
  onlineAt?: string;
};

type PresenceSubscriptionOptions = {
  topic: string;
  currentUser: PresenceUserState;
  onSync: (users: PresenceUserState[]) => void;
};

function getRealtimeClientConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseClientKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseClientKey) {
    console.warn(
      "Supabase Realtime is disabled because NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing.",
    );
    return null;
  }

  return { supabaseUrl, supabaseClientKey };
}

async function requestRealtimeToken(topics: string[]) {
  const response = await fetch("/api/realtime/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topics }),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error ?? "No se pudo autorizar el canal realtime.");
  }

  const payload = (await response.json()) as { token: string };
  return payload.token;
}

function buildRealtimeAuthConfig(storageKey: string) {
  return {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey,
  };
}

function buildTopicStorageKey(prefix: string, topics: string[]) {
  const topicKey = topics
    .slice()
    .sort()
    .join("-")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 96);

  return topicKey ? `${prefix}-${topicKey}` : prefix;
}

function createScopedRealtimeClient(topics: string[]): ScopedRealtimeClient | null {
  const config = getRealtimeClientConfig();
  if (!config) {
    return null;
  }

  return createClient(config.supabaseUrl, config.supabaseClientKey, {
    auth: buildRealtimeAuthConfig(buildTopicStorageKey("recalc-realtime-private", topics)),
    accessToken: () => requestRealtimeToken(topics),
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

function createRealtimeClient(): ScopedRealtimeClient | null {
  const config = getRealtimeClientConfig();
  if (!config) {
    return null;
  }

  return createClient(config.supabaseUrl, config.supabaseClientKey, {
    auth: buildRealtimeAuthConfig("recalc-realtime-public"),
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

async function disposeScopedChannel(
  client: ScopedRealtimeClient | null,
  channel: RealtimeChannel | null,
) {
  if (!client || !channel) {
    return;
  }

  await client.removeChannel(channel);
  await client.realtime.disconnect();
}

export function subscribeToPrivateBroadcast<TPayload>({
  topic,
  event,
  onMessage,
}: BroadcastSubscriptionOptions<TPayload>) {
  const client = createScopedRealtimeClient([topic]);
  if (!client) {
    return () => {};
  }

  const channel = client.channel(topic, {
    config: {
      private: true,
      broadcast: { self: false },
    },
  });

  channel.on("broadcast", { event }, (payload) => {
    if (payload.payload) {
      onMessage(payload.payload as TPayload);
    }
  });

  channel.subscribe((status, error) => {
    if (status === "CHANNEL_ERROR") {
      console.error(`Realtime channel error for ${topic}:`, error);
    }
  });

  return () => {
    void disposeScopedChannel(client, channel);
  };
}

export function subscribeToBroadcast<TPayload>({
  topic,
  event,
  onMessage,
}: BroadcastSubscriptionOptions<TPayload>) {
  const client = createRealtimeClient();
  if (!client) {
    return () => {};
  }

  const channel = client.channel(topic, {
    config: {
      broadcast: { self: false },
    },
  });

  channel.on("broadcast", { event }, (payload) => {
    if (payload.payload) {
      onMessage(payload.payload as TPayload);
    }
  });

  channel.subscribe((status, error) => {
    if (status === "CHANNEL_ERROR") {
      console.error(`Realtime channel error for ${topic}:`, error);
    }
  });

  return () => {
    void disposeScopedChannel(client, channel);
  };
}

function buildPresenceSnapshot(channel: RealtimeChannel): PresenceUserState[] {
  const state = channel.presenceState();
  const users = new Map<string, PresenceUserState>();

  Object.values(state).forEach((entries) => {
    entries.forEach((entry) => {
      const user = entry as Record<string, unknown>;
      const userId = String(user.userId ?? "");
      if (!userId) {
        return;
      }

      users.set(userId, {
        userId,
        displayName: String(user.displayName ?? ""),
        accessRole: typeof user.accessRole === "string" ? user.accessRole : undefined,
        isAnonymous: typeof user.isAnonymous === "boolean" ? user.isAnonymous : undefined,
        anonymousAlias:
          typeof user.anonymousAlias === "string" ? user.anonymousAlias : undefined,
        onlineAt: typeof user.onlineAt === "string" ? user.onlineAt : undefined,
        status: "online",
      });
    });
  });

  return Array.from(users.values());
}

export function subscribeToPrivatePresence({
  topic,
  currentUser,
  onSync,
}: PresenceSubscriptionOptions) {
  const client = createScopedRealtimeClient([topic]);
  if (!client) {
    return () => {};
  }

  const channel = client.channel(topic, {
    config: {
      private: true,
      presence: {
        key: currentUser.userId,
      },
    },
  });

  channel.on("presence", { event: "sync" }, () => {
    onSync(buildPresenceSnapshot(channel));
  });

  channel.on("presence", { event: "join" }, () => {
    onSync(buildPresenceSnapshot(channel));
  });

  channel.on("presence", { event: "leave" }, () => {
    onSync(buildPresenceSnapshot(channel));
  });

  channel.subscribe(async (status, error) => {
    if (status === "SUBSCRIBED") {
      await channel.track({
        ...currentUser,
        onlineAt: new Date().toISOString(),
      });
      return;
    }

    if (status === "CHANNEL_ERROR") {
      console.error(`Realtime presence error for ${topic}:`, error);
    }
  });

  return () => {
    void channel.untrack();
    void disposeScopedChannel(client, channel);
  };
}

export function subscribeToPresence({
  topic,
  currentUser,
  onSync,
}: PresenceSubscriptionOptions) {
  const client = createRealtimeClient();
  if (!client) {
    return () => {};
  }

  const channel = client.channel(topic, {
    config: {
      presence: {
        key: currentUser.userId,
      },
    },
  });

  channel.on("presence", { event: "sync" }, () => {
    onSync(buildPresenceSnapshot(channel));
  });

  channel.on("presence", { event: "join" }, () => {
    onSync(buildPresenceSnapshot(channel));
  });

  channel.on("presence", { event: "leave" }, () => {
    onSync(buildPresenceSnapshot(channel));
  });

  channel.subscribe(async (status, error) => {
    if (status === "SUBSCRIBED") {
      await channel.track({
        ...currentUser,
        onlineAt: new Date().toISOString(),
      });
      return;
    }

    if (status === "CHANNEL_ERROR") {
      console.error(`Realtime presence error for ${topic}:`, error);
    }
  });

  return () => {
    void channel.untrack();
    void disposeScopedChannel(client, channel);
  };
}
