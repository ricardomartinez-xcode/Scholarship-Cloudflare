import { d1All, d1First, d1Run } from "@/lib/cloudflare/d1";

type D1UserRow = { id: string; email: string; display_name: string | null };
type D1ThreadRow = {
  id: string;
  title: string | null;
  status: string;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
};
type D1MemberRow = D1UserRow & { conversation_id: string };
type D1MessageRow = {
  id: string;
  conversation_id: string;
  content_text: string | null;
  created_at: string;
  sender_user_id: string | null;
  sender_email: string | null;
  sender_display_name: string | null;
};

function displayName(input: { email: string; display_name?: string | null }) {
  return input.display_name?.trim() || input.email.split("@")[0] || input.email;
}

function identity(input: D1UserRow) {
  return { userId: input.id, email: input.email, displayName: displayName(input) };
}

async function assertMember(userId: string, threadId: string) {
  const member = await d1First<{ id: string }>(
    "SELECT id FROM conversation_member WHERE conversation_id = ? AND user_id = ? LIMIT 1",
    [threadId, userId],
  );
  if (!member) throw new Error("No tienes acceso a este hilo.");
  return member;
}

async function listParticipants(threadIds: string[]) {
  if (!threadIds.length) return new Map<string, ReturnType<typeof identity>[]>();
  const placeholders = threadIds.map(() => "?").join(", ");
  const rows = await d1All<D1MemberRow>(
    `SELECT cm.conversation_id, u.id, u.email, u.display_name
       FROM conversation_member cm
       INNER JOIN cloudflare_auth_user u ON u.id = cm.user_id
      WHERE cm.conversation_id IN (${placeholders})
      ORDER BY cm.joined_at ASC`,
    threadIds,
  );
  const grouped = new Map<string, ReturnType<typeof identity>[]>();
  for (const row of rows) {
    const entry = grouped.get(row.conversation_id) ?? [];
    entry.push(identity(row));
    grouped.set(row.conversation_id, entry);
  }
  return grouped;
}

export async function listD1InboxThreadsForUser(userId: string) {
  const threads = await d1All<D1ThreadRow>(
    `SELECT c.id, c.title, c.status, c.organization_id, c.created_at, c.updated_at, c.last_message_at,
            (SELECT m.content_text
               FROM conversation_message m
              WHERE m.conversation_id = c.id
              ORDER BY m.created_at DESC
              LIMIT 1) AS last_message_preview
       FROM conversation c
       INNER JOIN conversation_member viewer ON viewer.conversation_id = c.id AND viewer.user_id = ?
      WHERE c.channel = 'internal'
      ORDER BY COALESCE(c.last_message_at, c.updated_at) DESC
      LIMIT 100`,
    [userId],
  );
  const participants = await listParticipants(threads.map((thread) => thread.id));
  const eligibleRows = await d1All<D1UserRow>(
    `SELECT id, email, display_name
       FROM cloudflare_auth_user
      WHERE is_active = 1 AND id <> ?
      ORDER BY COALESCE(display_name, email) ASC
      LIMIT 200`,
    [userId],
  );

  return {
    threads: threads.map((thread) => {
      const members = participants.get(thread.id) ?? [];
      return {
        id: thread.id,
        subject: thread.title,
        status: thread.status === "closed" ? "archived" : "active",
        organizationId: thread.organization_id,
        organizationName: null,
        createdAt: thread.created_at,
        updatedAt: thread.updated_at,
        lastMessageAt: thread.last_message_at,
        lastMessagePreview: thread.last_message_preview,
        lastMessageSender: null,
        participantCount: members.length,
        participants: members,
      };
    }),
    eligibleUsers: eligibleRows.map(identity),
  };
}

export async function createD1InboxThreadForUser(input: {
  actorUserId: string;
  recipientUserId: string;
  subject?: string | null;
}) {
  if (input.actorUserId === input.recipientUserId) {
    throw new Error("Selecciona un destinatario distinto.");
  }
  const recipient = await d1First<{ id: string }>(
    "SELECT id FROM cloudflare_auth_user WHERE id = ? AND is_active = 1 LIMIT 1",
    [input.recipientUserId],
  );
  if (!recipient) throw new Error("El usuario seleccionado no existe o está inactivo.");

  const existing = await d1First<{ id: string }>(
    `SELECT c.id
       FROM conversation c
      WHERE c.channel = 'internal'
        AND (SELECT COUNT(*) FROM conversation_member cm WHERE cm.conversation_id = c.id) = 2
        AND (SELECT COUNT(*) FROM conversation_member cm WHERE cm.conversation_id = c.id AND cm.user_id IN (?, ?)) = 2
      LIMIT 1`,
    [input.actorUserId, input.recipientUserId],
  );
  if (existing?.id) return existing.id;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await d1Run(
    `INSERT INTO conversation (id, channel, status, title, metadata_json, created_at, updated_at)
     VALUES (?, 'internal', 'open', ?, '{}', ?, ?)`,
    [id, input.subject?.trim() || null, now, now],
  );
  await d1Run(
    `INSERT INTO conversation_member (id, conversation_id, member_type, user_id, role, joined_at)
     VALUES (?, ?, 'user', ?, 'participant', ?)`,
    [crypto.randomUUID(), id, input.actorUserId, now],
  );
  await d1Run(
    `INSERT INTO conversation_member (id, conversation_id, member_type, user_id, role, joined_at)
     VALUES (?, ?, 'user', ?, 'participant', ?)`,
    [crypto.randomUUID(), id, input.recipientUserId, now],
  );
  return id;
}

export async function renameD1InboxThreadForUser(input: { actorUserId: string; threadId: string; subject: string | null }) {
  await assertMember(input.actorUserId, input.threadId);
  const now = new Date().toISOString();
  await d1Run("UPDATE conversation SET title = ?, updated_at = ? WHERE id = ?", [input.subject?.trim() || null, now, input.threadId]);
  return { id: input.threadId, subject: input.subject?.trim() || null, status: "active" };
}

export async function archiveD1InboxThreadForUser(input: { actorUserId: string; threadId: string }) {
  await assertMember(input.actorUserId, input.threadId);
  const now = new Date().toISOString();
  await d1Run("UPDATE conversation SET status = 'closed', updated_at = ? WHERE id = ?", [now, input.threadId]);
  return { id: input.threadId, subject: null, status: "archived" };
}

export async function deleteD1InboxThreadForUser(input: { actorUserId: string; threadId: string }) {
  await assertMember(input.actorUserId, input.threadId);
  await d1Run("DELETE FROM conversation WHERE id = ?", [input.threadId]);
  return { id: input.threadId };
}

export async function listD1InboxMessagesForUser(userId: string, threadId: string) {
  const access = await d1First<{ id: string }>(
    "SELECT id FROM conversation_member WHERE conversation_id = ? AND user_id = ? LIMIT 1",
    [threadId, userId],
  );
  if (!access) return null;
  const rows = await d1All<D1MessageRow>(
    `SELECT m.id, m.conversation_id, m.content_text, m.created_at,
            u.id AS sender_user_id, u.email AS sender_email, u.display_name AS sender_display_name
       FROM conversation_message m
       LEFT JOIN conversation_member member ON member.id = m.sender_member_id
       LEFT JOIN cloudflare_auth_user u ON u.id = member.user_id
      WHERE m.conversation_id = ? AND m.direction = 'internal'
      ORDER BY m.created_at ASC
      LIMIT 200`,
    [threadId],
  );
  return {
    messages: rows.map((row) => ({
      id: row.id,
      threadId: row.conversation_id,
      content: row.content_text ?? "",
      createdAt: row.created_at,
      sender: row.sender_user_id && row.sender_email
        ? { userId: row.sender_user_id, email: row.sender_email, displayName: displayName({ email: row.sender_email, display_name: row.sender_display_name }) }
        : { userId: "", email: "sistema@local", displayName: "Sistema" },
    })),
  };
}

export async function createD1InboxMessageForUser(input: { actorUserId: string; threadId: string; content: string }) {
  const member = await assertMember(input.actorUserId, input.threadId);
  const actor = await d1First<D1UserRow>(
    "SELECT id, email, display_name FROM cloudflare_auth_user WHERE id = ? LIMIT 1",
    [input.actorUserId],
  );
  if (!actor) throw new Error("No se encontró el usuario de la sesión.");
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await d1Run(
    `INSERT INTO conversation_message (id, conversation_id, sender_member_id, direction, content_text, content_json, status, created_at)
     VALUES (?, ?, ?, 'internal', ?, '{}', 'accepted', ?)`,
    [id, input.threadId, member.id, input.content.trim(), now],
  );
  await d1Run(
    "UPDATE conversation SET last_message_at = ?, updated_at = ? WHERE id = ?",
    [now, now, input.threadId],
  );
  return {
    id,
    threadId: input.threadId,
    content: input.content.trim(),
    createdAt: now,
    sender: identity(actor),
  };
}

export async function listD1InboxThreadRecipientUserIds(threadId: string, excludeUserId?: string) {
  const rows = await d1All<{ user_id: string }>(
    `SELECT user_id FROM conversation_member
      WHERE conversation_id = ? AND user_id IS NOT NULL ${excludeUserId ? "AND user_id <> ?" : ""}`,
    excludeUserId ? [threadId, excludeUserId] : [threadId],
  );
  return rows.map((row) => row.user_id);
}
