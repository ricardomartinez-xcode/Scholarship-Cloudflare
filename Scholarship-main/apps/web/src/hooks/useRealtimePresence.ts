"use client";

import { useEffect, useState } from "react";

import {
  subscribeToPrivatePresence,
  type PresenceUserState,
} from "@/lib/supabase/client";

type UseRealtimePresenceOptions = {
  topic: string | null;
  currentUser: PresenceUserState | null;
};

export function useRealtimePresence({
  topic,
  currentUser,
}: UseRealtimePresenceOptions) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUserState[]>([]);

  useEffect(() => {
    if (!topic || !currentUser) {
      return;
    }

    const unsubscribe = subscribeToPrivatePresence({
      topic,
      currentUser,
      onSync: (users) => {
        setOnlineUsers(users);
      },
    });

    return () => {
      unsubscribe?.();
    };
  }, [currentUser, topic]);

  return {
    onlineUsers: topic && currentUser ? onlineUsers : [],
    isLoading: false,
  };
}
