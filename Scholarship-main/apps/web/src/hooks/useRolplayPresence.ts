"use client";

import { useRealtimePresence } from "@/hooks/useRealtimePresence";
import { realtimeTopics } from "@/lib/realtime-topics";

export type OnlineUser = {
  userId: string;
  displayName: string;
  accessRole?: string;
  isAnonymous?: boolean;
  anonymousAlias?: string;
  status?: "online";
  onlineAt?: string;
};

export function useRolplayPresence(
  roomId: string,
  currentUser: {
    userId: string;
    displayName: string;
    accessRole?: string;
    isAnonymous?: boolean;
    anonymousAlias?: string;
  } | null,
) {
  return useRealtimePresence({
    topic: roomId ? realtimeTopics.trainingRoomPresence(roomId) : null,
    currentUser: currentUser
      ? {
          userId: currentUser.userId,
          displayName: currentUser.displayName,
          accessRole: currentUser.accessRole,
          isAnonymous: currentUser.isAnonymous,
          anonymousAlias: currentUser.anonymousAlias,
        }
      : null,
  });
}
