"use client";

import { useEffect, useState } from "react";

import {
  subscribeToPresence,
  subscribeToPrivatePresence,
  type PresenceUserState,
} from "@/lib/supabase/client";

type UseRealtimePresenceOptions = {
  topic: string | null;
  currentUser: PresenceUserState | null;
  privateChannel?: boolean;
};

export function useRealtimePresence({
  topic,
  currentUser,
  privateChannel = true,
}: UseRealtimePresenceOptions) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUserState[]>([]);

  useEffect(() => {
    if (!topic || !currentUser) {
      return;
    }

    const subscribe =
      privateChannel === false ? subscribeToPresence : subscribeToPrivatePresence;
    const unsubscribe = subscribe({
      topic,
      currentUser,
      onSync: (users) => {
        setOnlineUsers(users);
      },
    });

    return () => {
      unsubscribe?.();
    };
  }, [currentUser, privateChannel, topic]);

  return {
    onlineUsers: topic && currentUser ? onlineUsers : [],
    isLoading: false,
  };
}
