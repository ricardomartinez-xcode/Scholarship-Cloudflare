import "server-only";

/**
 * Persistent realtime is handled by Supabase Postgres Changes on the client.
 * These functions remain as compatibility no-ops for existing domain services
 * that call a notification hook after writing a message.
 */

export async function broadcastTrainingMessage(
  _chatId: string,
  _payload: Record<string, unknown>,
) {
  return true;
}

export async function broadcastInboxMessage(
  _threadId: string,
  _payload: Record<string, unknown>,
) {
  return true;
}
