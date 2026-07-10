"use client";

/**
 * Supabase Realtime client utilities.
 *
 * Supabase Auth provides the realtime JWT through the browser client.
 * Persistent messages use Postgres Changes; ephemeral user state uses Presence.
 */

import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type ScopedRealtimeClient = ReturnType<typeof createSupabaseBrowserClient>;
type ActiveRealtimeSubscription = {
  client: ScopedRealtimeClient;
  channel: RealtimeChannel;
  beforeDispose?: () => Promise<void> | void;
};

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

async function createScopedRealtimeClient(): Promise<ScopedRealtimeClient> {
  return createSupabaseBrowserClient();
}

async function createRealtimeClient(): Promise<ScopedRealtimeClient> {
  return createSupabaseBrowserClient();
}

async function disposeScopedChannel(
  client: ScopedRealtimeClient | null,
  channel: RealtimeChannel | null,
) {
  if (!client || !channel) {
    return;
  }

  await client.removeChannel(channel);
}

async function disposeRealtimeSubscription(subscription: ActiveRealtimeSubscription) {
  await subscription.beforeDispose?.();
  await disposeScopedChannel(subscription.client, subscription.channel);
}

function startRealtimeSubscription(
  setup: () => Promise<ActiveRealtimeSubscription | null>,
) {
  let activeSubscription: ActiveRealtimeSubscription | null = null;
  let disposed = false;

  void setup()
    .then((subscription) => {
      if (!subscription) {
        return;
      }

      if (disposed) {
        void disposeRealtimeSubscription(subscription);
        return;
      }

      activeSubscription = subscription;
    })
    .catch((error) => {
      console.error("Failed to start realtime subscription:", error);
    });

  return () => {
    disposed = true;
    if (!activeSubscription) {
      return;
    }

    const subscription = activeSubscription;
    activeSubscription = null;
    void disposeRealtimeSubscription(subscription);
  };
}

export function subscribeToPrivateBroadcast<TPayload>({
  topic,
  event,
  onMessage,
}: BroadcastSubscriptionOptions<TPayload>) {
  return startRealtimeSubscription(async () => {
    const client = await createScopedRealtimeClient();

    const channel = client.channel(topic, {
      config: {
        private: true,
        broadcast: { self: false },
      },
    });

    channel.on("broadcast", { event }, (payload: { payload?: unknown }) => {
      if (payload.payload) {
        onMessage(payload.payload as TPayload);
      }
    });

    channel.subscribe((status: string, error?: Error) => {
      if (status === "CHANNEL_ERROR") {
        console.error(`Realtime channel error for ${topic}:`, error);
      }
    });

    return { client, channel };
  });
}

export function subscribeToBroadcast<TPayload>({
  topic,
  event,
  onMessage,
}: BroadcastSubscriptionOptions<TPayload>) {
  return startRealtimeSubscription(async () => {
    const client = await createRealtimeClient();

    const channel = client.channel(topic, {
      config: {
        broadcast: { self: false },
      },
    });

    channel.on("broadcast", { event }, (payload: { payload?: unknown }) => {
      if (payload.payload) {
        onMessage(payload.payload as TPayload);
      }
    });

    channel.subscribe((status: string, error?: Error) => {
      if (status === "CHANNEL_ERROR") {
        console.error(`Realtime channel error for ${topic}:`, error);
      }
    });

    return { client, channel };
  });
}

function resolvePostgresMessageSubscription(topic: string) {
  const inboxMatch = topic.match(/^inbox:thread:([^:]+):messages$/);
  if (inboxMatch?.[1]) {
    return {
      table: "inbox_message",
      filter: `threadId=eq.${inboxMatch[1]}`,
    };
  }

  const trainingMatch = topic.match(/^training:chat:([^:]+):messages$/);
  if (trainingMatch?.[1]) {
    return {
      table: "TrainingMessage",
      filter: `chatId=eq.${trainingMatch[1]}`,
    };
  }

  return null;
}

export function subscribeToPostgresMessages({
  topic,
  onChange,
}: {
  topic: string;
  onChange: () => void;
}) {
  return startRealtimeSubscription(async () => {
    const messageSubscription = resolvePostgresMessageSubscription(topic);
    if (!messageSubscription) {
      return null;
    }

    const client = await createScopedRealtimeClient();
    const channel = client.channel(`${topic}:postgres_changes`);

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "recalc_admin",
        table: messageSubscription.table,
        filter: messageSubscription.filter,
      },
      () => {
        onChange();
      },
    );

    channel.subscribe((status: string, error?: Error) => {
      if (status === "CHANNEL_ERROR") {
        console.error(`Realtime postgres changes error for ${topic}:`, error);
      }
    });

    return { client, channel };
  });
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
  return startRealtimeSubscription(async () => {
    const client = await createScopedRealtimeClient();

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

    channel.subscribe(async (status: string, error?: Error) => {
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

    return {
      client,
      channel,
      beforeDispose: async () => {
        await channel.untrack();
      },
    };
  });
}

export function subscribeToPresence({
  topic,
  currentUser,
  onSync,
}: PresenceSubscriptionOptions) {
  return startRealtimeSubscription(async () => {
    const client = await createRealtimeClient();

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

    channel.subscribe(async (status: string, error?: Error) => {
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

    return {
      client,
      channel,
      beforeDispose: async () => {
        await channel.untrack();
      },
    };
  });
}
