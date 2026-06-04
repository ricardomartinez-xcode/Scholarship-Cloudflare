"use client";

import { TrainingAccessRole } from "@prisma/client";
import { useEffect, useMemo, useRef, useState } from "react";

import { useTrainingAccess } from "@/components/capacitacion/TrainingAccessProvider";
import {
  ChatAvatar,
  ChatEmptyState,
  ChatLoadingStack,
  ChatMessageBubble,
  ChatPanelCard,
} from "@/components/ui/chat-workspace";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useRealtimePresence } from "@/hooks/useRealtimePresence";
import { realtimeTopics } from "@/lib/realtime-topics";

type TrainingIdentity = {
  userId: string;
  accessRole: TrainingAccessRole;
  displayName: string;
  alias: string | null;
  isAnonymous: boolean;
  realDisplayName: string | null;
  email: string | null;
};

type RoomSummary = {
  id: string;
  name: string;
  description: string | null;
  scenario: string | null;
  visibility: "private" | "org" | "public";
  memberCount: number;
  chatCount: number;
};

type ChatSummary = {
  id: string;
  roomId: string;
  title: string | null;
  status: "open" | "closed" | "archived";
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  participants: TrainingIdentity[];
};

type MemberSummary = TrainingIdentity & { membershipId: string };
type EligibleUser = { userId: string; displayName: string; email: string };
type MessageSummary = {
  id: string;
  content: string;
  createdAt: string;
  sender: TrainingIdentity;
};
type FeedbackSummary = {
  id: string;
  rating: number | null;
  summary: string;
  createdAt: string;
  author: TrainingIdentity;
  target: TrainingIdentity;
};
type RoomAccessPayload = {
  effectiveRole: "user" | "moderator" | "admin" | "owner";
  capabilities: {
    canManageRoom: boolean;
    canManageMembers: boolean;
    canManageChats: boolean;
    canLeaveFeedback: boolean;
    canEvaluate: boolean;
  };
};
type RoleplayAgentMode =
  | "prospecto_indeciso"
  | "prospecto_objecion_precio"
  | "prospecto_comparando_escuelas"
  | "coach_ventas"
  | "evaluador";
type RoleplayAgentDifficulty = "basica" | "media" | "dificil";
type RoleplayAgentDefinition = {
  mode: RoleplayAgentMode;
  label: string;
  participantLabel: string;
  description: string;
};

const ROLEPLAY_AGENT_EMAIL = "sales-roleplay-agent@system.recalc.local";

function readTime(value: string | null) {
  if (!value) return "Sin actividad";
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function chatTitle(chat: ChatSummary, viewerId?: string) {
  if (chat.title?.trim()) return chat.title;
  const peers = chat.participants.filter(
    (participant) => participant.userId !== viewerId,
  );
  return peers.map((participant) => participant.displayName).join(" • ") || "Práctica";
}

function avatarLabel(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

function practiceStatus(chat: ChatSummary) {
  if (chat.status === "closed" || chat.status === "archived") return "cerrado";
  if (!chat.lastMessagePreview) return "pendiente";
  return "activo";
}

function practiceType(chat: ChatSummary, room: RoomSummary | null) {
  return chat.title?.trim() || room?.scenario || "Simulación 1:1";
}

function isRoleplayAgentIdentity(identity: TrainingIdentity) {
  const haystack = [
    identity.email,
    identity.displayName,
    identity.alias,
    identity.realDisplayName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    haystack.includes(ROLEPLAY_AGENT_EMAIL) ||
    haystack.includes("roleplay-agent") ||
    haystack.includes("agente ia") ||
    haystack.includes("prospecto ia") ||
    haystack.includes("coach ia") ||
    haystack.includes("evaluador ia")
  );
}

async function readJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, { cache: "no-store", ...init });
  const payload = (await response.json().catch(() => null)) as (T & {
    error?: string;
  }) | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? "La operación no se pudo completar.");
  }
  return payload as T;
}

export default function RolplayWorkspace() {
  const {
    viewer,
    permissions,
    selectedOrganizationId,
    organizations,
    selectOrganization,
    isLoading: accessLoading,
  } = useTrainingAccess();
  const feedbackRef = useRef<HTMLTextAreaElement | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [roomAccess, setRoomAccess] = useState<RoomAccessPayload | null>(null);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [eligibleUsers, setEligibleUsers] = useState<EligibleUser[]>([]);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [selectedChatId, setSelectedChatId] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [feedbackEntries, setFeedbackEntries] = useState<FeedbackSummary[]>([]);
  const [roleplayAgents, setRoleplayAgents] = useState<RoleplayAgentDefinition[]>([]);
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const [chatSearch, setChatSearch] = useState("");
  const [chatFilter, setChatFilter] = useState<
    ReturnType<typeof practiceStatus>
  >("activo");
  const [roomForm, setRoomForm] = useState({
    open: false,
    roomId: "",
    name: "",
    description: "",
    scenario: "",
    visibility: "org" as RoomSummary["visibility"],
  });
  const [memberForm, setMemberForm] = useState({
    targetUserId: "",
    accessRole: TrainingAccessRole.user as TrainingAccessRole,
    isAnonymous: true,
    anonymousAlias: "",
  });
  const [chatForm, setChatForm] = useState({
    title: "",
    participantUserIds: [] as string[],
    includeActor: true,
  });
  const [feedbackForm, setFeedbackForm] = useState({
    targetUserId: "",
    rating: "5",
    summary: "",
  });
  const [agentForm, setAgentForm] = useState({
    mode: "prospecto_indeciso" as RoleplayAgentMode,
    difficulty: "media" as RoleplayAgentDifficulty,
    scenario: "",
    extraInstructions: "",
  });

  const activeRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const activeChat = chats.find((chat) => chat.id === selectedChatId) ?? null;
  const currentMember =
    members.find((member) => member.userId === viewer?.userId) ?? null;

  useEffect(() => {
    let cancelled = false;
    async function loadAgents() {
      if (!permissions.canViewRolplay) {
        setRoleplayAgents([]);
        return;
      }
      try {
        const payload = await readJson<{ agents: RoleplayAgentDefinition[] }>(
          "/api/capacitacion/agents",
        );
        if (!cancelled) setRoleplayAgents(payload.agents ?? []);
      } catch {
        if (!cancelled) setRoleplayAgents([]);
      }
    }
    void loadAgents();
    return () => {
      cancelled = true;
    };
  }, [permissions.canViewRolplay]);

  useEffect(() => {
    let cancelled = false;
    async function loadRooms() {
      if (!selectedOrganizationId || !permissions.canViewRolplay) {
        setRooms([]);
        setSelectedRoomId("");
        return;
      }

      try {
        const payload = await readJson<{ rooms: RoomSummary[] }>(
          `/api/capacitacion/rooms?orgId=${encodeURIComponent(
            selectedOrganizationId,
          )}`,
        );
        if (cancelled) return;
        setRooms(payload.rooms ?? []);
        setSelectedRoomId((current) =>
          current && payload.rooms.some((room) => room.id === current)
            ? current
            : payload.rooms[0]?.id ?? "",
        );
      } catch (error) {
        if (!cancelled) {
          setRooms([]);
          setRoomsError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar las salas.",
          );
        }
      }
    }
    void loadRooms();
    return () => {
      cancelled = true;
    };
  }, [permissions.canViewRolplay, selectedOrganizationId]);

  useEffect(() => {
    let cancelled = false;
    async function loadContext() {
      if (!selectedRoomId) {
        setMembers([]);
        setEligibleUsers([]);
        setChats([]);
        setSelectedChatId("");
        setRoomAccess(null);
        return;
      }

      try {
        const [membersPayload, chatsPayload] = await Promise.all([
          readJson<{
            roomAccess: RoomAccessPayload;
            members: MemberSummary[];
            eligibleUsers: EligibleUser[];
          }>(`/api/capacitacion/rooms/${selectedRoomId}/members`),
          readJson<{ roomAccess: RoomAccessPayload; chats: ChatSummary[] }>(
            `/api/capacitacion/chats?roomId=${selectedRoomId}`,
          ),
        ]);
        if (cancelled) return;
        setRoomAccess(membersPayload.roomAccess ?? chatsPayload.roomAccess ?? null);
        setMembers(membersPayload.members ?? []);
        setEligibleUsers(membersPayload.eligibleUsers ?? []);
        setChats(chatsPayload.chats ?? []);
        setSelectedChatId((current) =>
          current && chatsPayload.chats.some((chat) => chat.id === current)
            ? current
            : chatsPayload.chats[0]?.id ?? "",
        );
      } catch (error) {
        if (!cancelled) {
          setRoomsError(
            error instanceof Error ? error.message : "No se pudo cargar la sala.",
          );
        }
      }
    }
    void loadContext();
    return () => {
      cancelled = true;
    };
  }, [selectedRoomId]);

  const { messages, setMessages, isLoading: messagesLoading, error: messagesError } =
    useRealtimeMessages<MessageSummary>({
      fetchUrl: selectedChatId
        ? `/api/capacitacion/chats/${selectedChatId}/messages`
        : null,
      topic: selectedChatId
        ? realtimeTopics.trainingChatMessages(selectedChatId)
        : null,
    });

  useEffect(() => {
    let cancelled = false;
    async function loadFeedback() {
      if (!selectedChatId) {
        setFeedbackEntries([]);
        return;
      }
      try {
        const payload = await readJson<{ feedback: FeedbackSummary[] }>(
          `/api/capacitacion/chats/${selectedChatId}/feedback`,
        );
        if (!cancelled) {
          setFeedbackEntries(payload.feedback ?? []);
        }
      } catch {
        if (!cancelled) setFeedbackEntries([]);
      }
    }
    void loadFeedback();
    return () => {
      cancelled = true;
    };
  }, [selectedChatId]);

  const roomPresence = useRealtimePresence({
    topic: selectedRoomId ? realtimeTopics.trainingRoomPresence(selectedRoomId) : null,
    currentUser:
      viewer && selectedRoomId
        ? {
            userId: viewer.userId,
            displayName: currentMember?.displayName ?? viewer.displayName,
            accessRole: currentMember?.accessRole ?? undefined,
            isAnonymous: currentMember?.isAnonymous ?? false,
            anonymousAlias: currentMember?.alias ?? undefined,
          }
        : null,
  });

  const chatPresence = useRealtimePresence({
    topic: selectedChatId ? realtimeTopics.trainingChatPresence(selectedChatId) : null,
    currentUser:
      viewer && selectedChatId
        ? {
            userId: viewer.userId,
            displayName: currentMember?.displayName ?? viewer.displayName,
            accessRole: currentMember?.accessRole ?? undefined,
            isAnonymous: currentMember?.isAnonymous ?? false,
            anonymousAlias: currentMember?.alias ?? undefined,
          }
        : null,
  });

  const feedbackTargets = useMemo(
    () =>
      activeChat?.participants.filter(
        (participant) =>
          participant.userId !== viewer?.userId &&
          !isRoleplayAgentIdentity(participant),
      ) ?? [],
    [activeChat, viewer?.userId],
  );

  const selectedFeedbackTargetId =
    feedbackForm.targetUserId &&
    feedbackTargets.some((target) => target.userId === feedbackForm.targetUserId)
      ? feedbackForm.targetUserId
      : feedbackTargets[0]?.userId ?? "";

  const visibleChats = useMemo(() => {
    return chats.filter((chat) => {
      const status = practiceStatus(chat);
      const title = chatTitle(chat, viewer?.userId).toLowerCase();
      const preview = (chat.lastMessagePreview || "").toLowerCase();
      const type = practiceType(chat, activeRoom).toLowerCase();
      const search = chatSearch.trim().toLowerCase();
      const matchesSearch = !search
        ? true
        : [title, preview, type].some((value) => value.includes(search));
      const matchesFilter = status === chatFilter;
      return matchesSearch && matchesFilter;
    });
  }, [activeRoom, chatFilter, chatSearch, chats, viewer?.userId]);

  const selectedAgentDefinition =
    roleplayAgents.find((agent) => agent.mode === agentForm.mode) ??
    roleplayAgents[0] ??
    null;

  const activeChatHasAgent = Boolean(
    activeChat?.participants.some(isRoleplayAgentIdentity),
  );

  async function refreshRooms() {
    if (!selectedOrganizationId) return;
    const payload = await readJson<{ rooms: RoomSummary[] }>(
      `/api/capacitacion/rooms?orgId=${encodeURIComponent(selectedOrganizationId)}`,
    );
    setRooms(payload.rooms ?? []);
  }

  async function refreshRoomContext() {
    if (!selectedRoomId) return;
    const [membersPayload, chatsPayload] = await Promise.all([
      readJson<{
        roomAccess: RoomAccessPayload;
        members: MemberSummary[];
        eligibleUsers: EligibleUser[];
      }>(`/api/capacitacion/rooms/${selectedRoomId}/members`),
      readJson<{ roomAccess: RoomAccessPayload; chats: ChatSummary[] }>(
        `/api/capacitacion/chats?roomId=${selectedRoomId}`,
      ),
    ]);
    setRoomAccess(membersPayload.roomAccess ?? chatsPayload.roomAccess ?? null);
    setMembers(membersPayload.members ?? []);
    setEligibleUsers(membersPayload.eligibleUsers ?? []);
    setChats(chatsPayload.chats ?? []);
  }

  async function saveRoom() {
    const body = {
      roomId: roomForm.roomId,
      name: roomForm.name,
      description: roomForm.description,
      scenario: roomForm.scenario,
      visibility: roomForm.visibility,
    };
    if (roomForm.roomId) {
      await readJson("/api/capacitacion/rooms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await readJson("/api/capacitacion/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, orgId: selectedOrganizationId }),
      });
    }
    setRoomForm({
      open: false,
      roomId: "",
      name: "",
      description: "",
      scenario: "",
      visibility: "org",
    });
    await refreshRooms();
  }

  async function saveMember() {
    await readJson(`/api/capacitacion/rooms/${selectedRoomId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(memberForm),
    });
    setMemberForm({
      targetUserId: "",
      accessRole: TrainingAccessRole.user,
      isAnonymous: true,
      anonymousAlias: "",
    });
    await refreshRoomContext();
  }

  async function createChat() {
    const payload = await readJson<{ chatId: string }>("/api/capacitacion/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: selectedRoomId,
        title: chatForm.title,
        participantUserIds: chatForm.participantUserIds,
        includeActor: chatForm.includeActor,
      }),
    });
    setChatForm({ title: "", participantUserIds: [], includeActor: true });
    await refreshRoomContext();
    setSelectedChatId(payload.chatId);
  }

  async function closeChat() {
    await readJson("/api/capacitacion/chats", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: selectedChatId, action: "close" }),
    });
    await refreshRoomContext();
  }

  async function sendMessage() {
    if (!selectedChatId || !messageInput.trim()) return;
    const payload = await readJson<{
      message: MessageSummary;
      agentMessage?: MessageSummary | null;
    }>(
      `/api/capacitacion/chats/${selectedChatId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageInput }),
      },
    );
    setMessages((current) => {
      const next = [...current];
      for (const message of [payload.message, payload.agentMessage].filter(
        Boolean,
      ) as MessageSummary[]) {
        if (!next.some((currentMessage) => currentMessage.id === message.id)) {
          next.push(message);
        }
      }
      return next;
    });
    setMessageInput("");
    await refreshRoomContext();
  }

  async function saveFeedback() {
    await readJson(`/api/capacitacion/chats/${selectedChatId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetUserId: selectedFeedbackTargetId,
        rating: Number(feedbackForm.rating),
        summary: feedbackForm.summary,
      }),
    });
    const payload = await readJson<{ feedback: FeedbackSummary[] }>(
      `/api/capacitacion/chats/${selectedChatId}/feedback`,
    );
    setFeedbackEntries(payload.feedback ?? []);
    setFeedbackForm({
      targetUserId: feedbackTargets[0]?.userId ?? "",
      rating: "5",
      summary: "",
    });
  }

  async function addAgentToChat() {
    if (!selectedChatId || !selectedAgentDefinition) return;
    setAgentBusy(true);
    setAgentStatus(null);
    try {
      await readJson(`/api/capacitacion/chats/${selectedChatId}/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agentForm),
      });
      setAgentStatus("Bot agregado. Responderá automático al siguiente mensaje.");
      await refreshRoomContext();
    } catch (error) {
      setAgentStatus(
        error instanceof Error ? error.message : "No se pudo agregar el agente.",
      );
    } finally {
      setAgentBusy(false);
    }
  }

  async function removeAgentFromChat() {
    if (!selectedChatId) return;
    setAgentBusy(true);
    setAgentStatus(null);
    try {
      await readJson(`/api/capacitacion/chats/${selectedChatId}/agents`, {
        method: "DELETE",
      });
      setAgentStatus("Agente removido.");
      await refreshRoomContext();
    } catch (error) {
      setAgentStatus(
        error instanceof Error ? error.message : "No se pudo remover el agente.",
      );
    } finally {
      setAgentBusy(false);
    }
  }

  async function generateAgentReply() {
    if (!selectedChatId || !selectedAgentDefinition) return;
    setAgentBusy(true);
    setAgentStatus(null);
    try {
      const payload = await readJson<{
        message: MessageSummary;
        ai: { ok: false; code: string; error: string };
      }>(`/api/capacitacion/chats/${selectedChatId}/agent-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(agentForm),
      });
      setMessages((current) =>
        current.some((message) => message.id === payload.message.id)
          ? current
          : [...current, payload.message],
      );
      setAgentStatus("Respuesta guionada generada.");
      await refreshRoomContext();
    } catch (error) {
      setAgentStatus(
        error instanceof Error ? error.message : "No se pudo generar respuesta.",
      );
    } finally {
      setAgentBusy(false);
    }
  }

  async function generateAgentEvaluation() {
    if (!selectedChatId) return;
    setAgentBusy(true);
    setAgentStatus(null);
    try {
      await readJson(`/api/capacitacion/chats/${selectedChatId}/agent-evaluation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: selectedFeedbackTargetId || null }),
      });
      const payload = await readJson<{ feedback: FeedbackSummary[] }>(
        `/api/capacitacion/chats/${selectedChatId}/feedback`,
      );
      setFeedbackEntries(payload.feedback ?? []);
      setAgentStatus("Evaluación generada.");
    } catch (error) {
      setAgentStatus(
        error instanceof Error ? error.message : "No se pudo generar evaluación.",
      );
    } finally {
      setAgentBusy(false);
    }
  }

  function focusFeedback() {
    feedbackRef.current?.focus();
  }

  function openFirstAvailableChat() {
    if (activeChat) return;
    const candidate = chats.find((chat) => chat.status === "open") ?? chats[0];
    if (candidate) {
      setSelectedChatId(candidate.id);
    }
  }

  if (accessLoading) {
    return (
      <div className="rounded-[28px] border border-[rgba(17,78,109,0.08)] bg-white/70 p-8 text-sm text-slate-600 shadow-[0_18px_40px_rgba(16,52,76,0.10)]">
        Verificando acceso a rolplay...
      </div>
    );
  }

  if (!permissions.canViewRolplay) {
    return (
      <div className="rounded-[28px] border border-[rgba(17,78,109,0.08)] bg-white/70 p-8 text-sm text-slate-600 shadow-[0_18px_40px_rgba(16,52,76,0.10)]">
        Tu acceso a rolplay sigue resolviéndose desde Neon/Auth actual y no está
        habilitado para esta organización.
      </div>
    );
  }

  return (
    <div className="ui-chat-workspace ui-chat-workspace--with-panel">
      <aside className="ui-chat-sidebar">
        <div className="ui-chat-sidebar__head">
          <div className="ui-kicker">Capacitación interna</div>
          <div className="ui-chat-sidebar__title">Rolplay</div>
          <div className="ui-chat-sidebar__copy">
            Alias anónimos, filtros por práctica y misma conversación realtime
            aislada por sala.
          </div>

          <select
            value={selectedOrganizationId ?? ""}
            onChange={(event) => selectOrganization(event.target.value)}
            className="ui-chat-field mt-4"
            aria-label="Organización de capacitación"
          >
            <option value="">Selecciona organización</option>
            {organizations.map((organization) => (
              <option
                key={organization.organizationId}
                value={organization.organizationId}
              >
                {organization.organizationName}
              </option>
            ))}
          </select>

          <select
            value={selectedRoomId}
            onChange={(event) => setSelectedRoomId(event.target.value)}
            className="ui-chat-field mt-3"
            aria-label="Sala de rolplay"
          >
            <option value="">Selecciona sala</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} · {room.memberCount} participante(s)
              </option>
            ))}
          </select>

          <input
            value={chatSearch}
            onChange={(event) => setChatSearch(event.target.value)}
            className="ui-chat-search"
            placeholder="Buscar prácticas o salas"
            aria-label="Buscar prácticas o salas"
            data-workspace-shortcut="search"
            aria-keyshortcuts="Control+K Meta+K /"
          />

          <div className="ui-chat-filter-row">
            <button
              type="button"
              onClick={() => setChatFilter("activo")}
              className={[
                "ui-chat-filter",
                chatFilter === "activo" ? "ui-chat-filter--active" : "",
              ].join(" ")}
            >
              Activos
            </button>
            <button
              type="button"
              onClick={() => setChatFilter("pendiente")}
              className={[
                "ui-chat-filter",
                chatFilter === "pendiente" ? "ui-chat-filter--active" : "",
              ].join(" ")}
            >
              Pendientes
            </button>
            <button
              type="button"
              onClick={() => setChatFilter("cerrado")}
              className={[
                "ui-chat-filter",
                chatFilter === "cerrado" ? "ui-chat-filter--active" : "",
              ].join(" ")}
            >
              Cerrados
            </button>
          </div>
        </div>

        <div className="ui-chat-list">
          {roomsError ? (
            <ChatEmptyState title="No se pudo cargar rolplay" copy={roomsError} />
          ) : null}
          {!roomsError && rooms.length === 0 ? (
            /* omit instructional copy when no rooms exist */
            <ChatEmptyState
              title="No hay salas disponibles"
              copy=""
            />
          ) : null}
          {!roomsError && rooms.length > 0 && chats.length === 0 ? (
            /* omit instructional copy when a room has no practices */
            <ChatEmptyState
              title="La sala no tiene prácticas"
              copy=""
            />
          ) : null}
          {!roomsError && chats.length > 0 && visibleChats.length === 0 ? (
            /* omit instructional copy when the filter yields no visible chats */
            <ChatEmptyState
              title="No hay coincidencias"
              copy=""
            />
          ) : null}

          {!roomsError &&
            visibleChats.map((chat) => {
              const status = practiceStatus(chat);
              const title = chatTitle(chat, viewer?.userId);
              const tone = status === "activo" ? "anonymous" : "default";
              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => setSelectedChatId(chat.id)}
                  className={[
                    "ui-chat-thread",
                    chat.id === selectedChatId ? "ui-chat-thread--active" : "",
                  ].join(" ")}
                >
                  <ChatAvatar
                    label={avatarLabel(title)}
                    tone={tone}
                    online={status === "activo"}
                  />
                  <div className="min-w-0">
                    <div className="ui-chat-thread__name-row">
                      <div className="ui-chat-thread__name">{title}</div>
                      <div className="ui-chat-thread__timestamp">
                        {readTime(chat.lastMessageAt)}
                      </div>
                    </div>
                    <div className="ui-chat-thread__preview">
                      {chat.lastMessagePreview || "Práctica lista para iniciar."}
                    </div>
                    <div className="ui-chat-thread__meta-row">
                      <div className="ui-chat-thread__status">
                        <span className="ui-chat-thread__status-dot" />
                        {status}
                      </div>
                      <div className="ui-chat-thread__status">
                        {practiceType(chat, activeRoom)}
                      </div>
                    </div>
                  </div>
                  <div>
                    {status === "activo" ? (
                      <span className="ui-chat-thread__badge">1</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
        </div>
      </aside>

      <section className="ui-chat-main">
        <header className="ui-chat-main__head">
          {activeChat ? (
            <div className="ui-chat-main__contact">
              <ChatAvatar
                label={avatarLabel(chatTitle(activeChat, viewer?.userId))}
                tone="anonymous"
                online={practiceStatus(activeChat) === "activo"}
              />
              <div>
                <div className="ui-chat-main__title">
                  {chatTitle(activeChat, viewer?.userId)}
                </div>
                <div className="ui-chat-main__copy">
                  {activeRoom?.name || "Sala"} · modo anónimo ·{" "}
                  {activeChat.participants.length} participante(s)
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="ui-chat-main__title">Selecciona una práctica</div>
              {/* omit instructional copy on empty practice selection */}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <span className="ui-pill">
              Sala: {activeRoom?.name || "Sin sala"}
            </span>
            <span className="ui-pill">
              {chatPresence.onlineUsers.length} en línea
            </span>
          </div>
        </header>

        <div className="ui-chat-main__messages">
          {activeChat ? (
            <>
              <div className="ui-chat-main__day">Práctica activa</div>
              {messagesLoading ? <ChatLoadingStack rows={6} /> : null}
              {messagesError ? (
                <ChatEmptyState
                  title="No se pudo cargar el chat"
                  copy={messagesError}
                />
              ) : null}
              {!messagesLoading && !messagesError && messages.length === 0 ? (
                /* omit instructional copy when no interventions exist */
                <ChatEmptyState
                  title="Sin intervenciones todavía"
                  copy=""
                />
              ) : null}
              {!messagesLoading &&
                !messagesError &&
                messages.map((message) => {
                  const isMine = message.sender.userId === viewer?.userId;
                  const isAgent = isRoleplayAgentIdentity(message.sender);
                  return (
                    <ChatMessageBubble
                      key={message.id}
                      align={isMine ? "out" : "in"}
                      author={
                        isAgent
                          ? `${message.sender.displayName} · IA`
                          : message.sender.displayName
                      }
                      timestamp={readTime(message.createdAt)}
                    >
                      {message.content}
                    </ChatMessageBubble>
                  );
                })}
            </>
          ) : (
            <ChatEmptyState
              title="Espacio de práctica listo"
              copy="La UI ya replica el modelo del mockup. Selecciona una conversación del sidebar o crea una nueva desde el panel derecho."
            />
          )}
        </div>

        <div className="ui-chat-composer">
          <textarea
            value={messageInput}
            onChange={(event) => setMessageInput(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (!event.shiftKey || event.ctrlKey || event.metaKey) &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            disabled={!activeChat || activeChat.status !== "open"}
            className="ui-chat-composer__field"
            aria-label="Mensaje de práctica"
            aria-keyshortcuts="Enter Control+Enter Meta+Enter Shift+Enter"
            placeholder={
              activeChat
                ? "Responder como asesor anónimo..."
                : "Selecciona una práctica"
            }
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={
              !activeChat || !messageInput.trim() || activeChat.status !== "open"
            }
            className="ui-chat-button"
            aria-keyshortcuts="Enter Control+Enter Meta+Enter"
          >
            Enviar
          </button>
        </div>
      </section>

      <aside className="ui-chat-panel">
        <div className="ui-chat-panel__head">
          <div className="ui-kicker">Moderación</div>
          <div className="ui-chat-panel__title">Contexto de práctica</div>
          <div className="ui-chat-panel__copy">
            Escenario, contexto, membresía y acciones del moderador reunidas en
            una sola columna.
          </div>
        </div>

        <div className="ui-chat-panel__scroll">
          <ChatPanelCard title="Escenario">
            <p className="ui-chat-copy">
              {activeRoom?.scenario ||
                "Define el escenario de venta o asesoría para esta sala."}
            </p>
          </ChatPanelCard>

          <ChatPanelCard title="Contexto">
            <div className="ui-chat-meta-list">
              <div className="ui-chat-meta-list__row">
                <span className="ui-chat-meta-list__label">Sala</span>
                <span>{activeRoom?.name || "Sin sala"}</span>
              </div>
              <div className="ui-chat-meta-list__row">
                <span className="ui-chat-meta-list__label">Modo</span>
                <span>Anónimo</span>
              </div>
              <div className="ui-chat-meta-list__row">
                <span className="ui-chat-meta-list__label">Participantes</span>
                <span>{activeRoom?.memberCount ?? 0}</span>
              </div>
              <div className="ui-chat-meta-list__row">
                <span className="ui-chat-meta-list__label">Práctica</span>
                <span>{activeChat ? practiceStatus(activeChat) : "Sin selección"}</span>
              </div>
              <div className="ui-chat-meta-list__row">
                <span className="ui-chat-meta-list__label">Tipo</span>
                <span>
                  {activeChat
                    ? practiceType(activeChat, activeRoom)
                    : activeRoom?.scenario || "Simulación 1:1"}
                </span>
              </div>
            </div>
          </ChatPanelCard>

          <ChatPanelCard title="Acciones del moderador">
            <div className="ui-chat-mini-form">
              <button
                type="button"
                onClick={openFirstAvailableChat}
                className="ui-chat-button"
              >
                Entrar al chat
              </button>
              <button
                type="button"
                onClick={() => void closeChat()}
                disabled={!roomAccess?.capabilities.canManageChats || !activeChat}
                className="ui-chat-button ui-chat-button--danger"
              >
                Cerrar práctica
              </button>
              <button
                type="button"
                onClick={focusFeedback}
                className="ui-chat-button ui-chat-button--secondary"
              >
                Dar feedback
              </button>
            </div>
          </ChatPanelCard>

          {roomAccess?.capabilities.canManageChats ? (
            <ChatPanelCard title="Bot de rolplay">
              <div className="ui-chat-mini-form">
                <select
                  value={agentForm.mode}
                  onChange={(event) =>
                    setAgentForm((current) => ({
                      ...current,
                      mode: event.target.value as RoleplayAgentMode,
                    }))
                  }
                  className="ui-chat-field"
                >
                  {roleplayAgents.map((agent) => (
                    <option key={agent.mode} value={agent.mode}>
                      {agent.label}
                    </option>
                  ))}
                </select>
                <select
                  value={agentForm.difficulty}
                  onChange={(event) =>
                    setAgentForm((current) => ({
                      ...current,
                      difficulty: event.target.value as RoleplayAgentDifficulty,
                    }))
                  }
                  className="ui-chat-field"
                >
                  <option value="basica">Básica</option>
                  <option value="media">Media</option>
                  <option value="dificil">Difícil</option>
                </select>
                <input
                  value={agentForm.scenario}
                  onChange={(event) =>
                    setAgentForm((current) => ({
                      ...current,
                      scenario: event.target.value,
                    }))
                  }
                  className="ui-chat-field"
                  placeholder="Escenario específico"
                />
                <textarea
                  value={agentForm.extraInstructions}
                  onChange={(event) =>
                    setAgentForm((current) => ({
                      ...current,
                      extraInstructions: event.target.value,
                    }))
                  }
                  className="ui-chat-field min-h-[76px]"
                  placeholder="Guiones, objeciones o ejemplos"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void addAgentToChat()}
                    disabled={!activeChat || agentBusy || roleplayAgents.length === 0}
                    className="ui-chat-button"
                  >
                    Agregar
                  </button>
                  <button
                    type="button"
                    onClick={() => void generateAgentReply()}
                    disabled={
                      !activeChat ||
                      activeChat.status !== "open" ||
                      agentBusy ||
                      roleplayAgents.length === 0
                    }
                    className="ui-chat-button ui-chat-button--secondary"
                  >
                    Responder ahora
                  </button>
                  <button
                    type="button"
                    onClick={() => void generateAgentEvaluation()}
                    disabled={!activeChat || agentBusy || feedbackTargets.length === 0}
                    className="ui-chat-button ui-chat-button--secondary"
                  >
                    Evaluar
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeAgentFromChat()}
                    disabled={!activeChat || agentBusy || !activeChatHasAgent}
                    className="ui-chat-button ui-chat-button--danger"
                  >
                    Remover
                  </button>
                </div>
                {agentStatus ? (
                  <p className="ui-chat-copy" role="status">
                    {agentStatus}
                  </p>
                ) : null}
              </div>
            </ChatPanelCard>
          ) : null}

          {roomAccess?.capabilities.canManageRoom ? (
            <ChatPanelCard title="Sala">
              <div className="ui-chat-mini-form">
                <button
                  type="button"
                  onClick={() =>
                    setRoomForm((current) => ({
                      ...current,
                      open: !current.open,
                      roomId: activeRoom?.id ?? "",
                      name: activeRoom?.name ?? "",
                      description: activeRoom?.description ?? "",
                      scenario: activeRoom?.scenario ?? "",
                      visibility: activeRoom?.visibility ?? "org",
                    }))
                  }
                  className="ui-chat-button ui-chat-button--secondary"
                >
                  {roomForm.open ? "Cerrar edición" : "Editar sala"}
                </button>
                {roomForm.open ? (
                  <>
                    <input
                      value={roomForm.name}
                      onChange={(event) =>
                        setRoomForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      className="ui-chat-field"
                      placeholder="Nombre de la sala"
                    />
                    <textarea
                      value={roomForm.description}
                      onChange={(event) =>
                        setRoomForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      className="ui-chat-field min-h-[84px]"
                      placeholder="Descripción"
                    />
                    <input
                      value={roomForm.scenario}
                      onChange={(event) =>
                        setRoomForm((current) => ({
                          ...current,
                          scenario: event.target.value,
                        }))
                      }
                      className="ui-chat-field"
                      placeholder="Escenario"
                    />
                    <select
                      value={roomForm.visibility}
                      onChange={(event) =>
                        setRoomForm((current) => ({
                          ...current,
                          visibility: event.target.value as RoomSummary["visibility"],
                        }))
                      }
                      className="ui-chat-field"
                    >
                      <option value="org">Org</option>
                      <option value="private">Privada</option>
                      <option value="public">Pública</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void saveRoom()}
                      className="ui-chat-button"
                    >
                      Guardar sala
                    </button>
                  </>
                ) : null}
              </div>
            </ChatPanelCard>
          ) : null}

          {roomAccess?.capabilities.canManageMembers ? (
            <ChatPanelCard title="Acceso a participantes">
              <div className="ui-chat-mini-form">
                <select
                  value={memberForm.targetUserId}
                  onChange={(event) =>
                    setMemberForm((current) => ({
                      ...current,
                      targetUserId: event.target.value,
                    }))
                  }
                  className="ui-chat-field"
                >
                  <option value="">Selecciona usuario</option>
                  {eligibleUsers.map((user) => (
                    <option key={user.userId} value={user.userId}>
                      {user.displayName} · {user.email}
                    </option>
                  ))}
                </select>
                <select
                  value={memberForm.accessRole}
                  onChange={(event) =>
                    setMemberForm((current) => ({
                      ...current,
                      accessRole: event.target.value as TrainingAccessRole,
                    }))
                  }
                  className="ui-chat-field"
                >
                  <option value="user">user</option>
                  <option value="moderator">moderator</option>
                  <option value="admin">admin</option>
                  {roomAccess.effectiveRole === "owner" ? (
                    <option value="owner">owner</option>
                  ) : null}
                </select>
                <label className="ui-chat-checkbox">
                  <input
                    type="checkbox"
                    checked={memberForm.isAnonymous}
                    onChange={(event) =>
                      setMemberForm((current) => ({
                        ...current,
                        isAnonymous: event.target.checked,
                      }))
                    }
                  />
                  Ocultar identidad real
                </label>
                <input
                  value={memberForm.anonymousAlias}
                  onChange={(event) =>
                    setMemberForm((current) => ({
                      ...current,
                      anonymousAlias: event.target.value,
                    }))
                  }
                  className="ui-chat-field"
                  placeholder="Alias anónimo"
                />
                <button
                  type="button"
                  onClick={() => void saveMember()}
                  className="ui-chat-button"
                >
                  Guardar acceso
                </button>
              </div>
            </ChatPanelCard>
          ) : null}

          {roomAccess?.capabilities.canManageChats ? (
            <ChatPanelCard title="Crear práctica">
              <div className="ui-chat-mini-form">
                <input
                  value={chatForm.title}
                  onChange={(event) =>
                    setChatForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className="ui-chat-field"
                  placeholder="Título opcional"
                />
                <label className="ui-chat-checkbox">
                  <input
                    type="checkbox"
                    checked={chatForm.includeActor}
                    onChange={(event) =>
                      setChatForm((current) => ({
                        ...current,
                        includeActor: event.target.checked,
                      }))
                    }
                  />
                  Incluirme como interlocutor
                </label>
                <div className="grid gap-2 rounded-[16px] border border-white/8 bg-white/5 p-3">
                  {members.length === 0 ? (
                    <div className="text-xs text-slate-200">
                      Agrega miembros a la sala para habilitar nuevos chats.
                    </div>
                  ) : (
                    members.map((member) => (
                      <label key={member.membershipId} className="ui-chat-checkbox">
                        <input
                          type="checkbox"
                          checked={chatForm.participantUserIds.includes(member.userId)}
                          onChange={(event) =>
                            setChatForm((current) => ({
                              ...current,
                              participantUserIds: event.target.checked
                                ? [...current.participantUserIds, member.userId]
                                : current.participantUserIds.filter(
                                    (userId) => userId !== member.userId,
                                  ),
                            }))
                          }
                        />
                        {member.displayName}
                      </label>
                    ))
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void createChat()}
                  className="ui-chat-button"
                >
                  Crear chat
                </button>
              </div>
            </ChatPanelCard>
          ) : null}

          <ChatPanelCard title="Feedback">
            {roomAccess?.capabilities.canEvaluate && activeChat ? (
              <div className="ui-chat-mini-form">
                <select
                  value={selectedFeedbackTargetId}
                  onChange={(event) =>
                    setFeedbackForm((current) => ({
                      ...current,
                      targetUserId: event.target.value,
                    }))
                  }
                  className="ui-chat-field"
                >
                  <option value="">Selecciona usuario</option>
                  {feedbackTargets.map((target) => (
                    <option key={target.userId} value={target.userId}>
                      {target.displayName}
                    </option>
                  ))}
                </select>
                <select
                  value={feedbackForm.rating}
                  onChange={(event) =>
                    setFeedbackForm((current) => ({
                      ...current,
                      rating: event.target.value,
                    }))
                  }
                  className="ui-chat-field"
                >
                  <option value="5">5 - Excelente</option>
                  <option value="4">4 - Sólido</option>
                  <option value="3">3 - Aceptable</option>
                  <option value="2">2 - Requiere apoyo</option>
                  <option value="1">1 - Crítico</option>
                </select>
                <textarea
                  ref={feedbackRef}
                  value={feedbackForm.summary}
                  onChange={(event) =>
                    setFeedbackForm((current) => ({
                      ...current,
                      summary: event.target.value,
                    }))
                  }
                  className="ui-chat-field min-h-[96px]"
                  placeholder="Resumen de la práctica"
                />
                <button
                  type="button"
                  onClick={() => void saveFeedback()}
                  className="ui-chat-button"
                >
                  Guardar feedback
                </button>
              </div>
            ) : (
              <p className="ui-chat-copy">
                {roomAccess?.effectiveRole === "admin"
                  ? "Admin puede supervisar pero no evaluar."
                  : "Necesitas rol moderator u owner para evaluar."}
              </p>
            )}

            <div className="ui-chat-stack mt-4">
              {feedbackEntries.length === 0 ? (
                <p className="ui-chat-copy">
                  Aún no hay feedback registrado para esta práctica.
                </p>
              ) : (
                feedbackEntries.map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-[16px] border border-white/8 bg-white/5 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">
                        {entry.target.displayName}
                      </div>
                      <span className="ui-pill">{entry.rating ?? "s/r"}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-200">
                      {entry.summary}
                    </p>
                    <div className="mt-2 text-xs text-slate-300">
                      {entry.author.displayName} · {readTime(entry.createdAt)}
                    </div>
                  </article>
                ))
              )}
            </div>
          </ChatPanelCard>

          <ChatPanelCard title="Presencia">
            {roomPresence.onlineUsers.length === 0 ? (
              <p className="ui-chat-copy">No hay participantes conectados.</p>
            ) : (
              <div className="ui-chat-stack">
                {roomPresence.onlineUsers.map((user) => (
                  <div
                    key={user.userId}
                    className="flex items-center justify-between gap-3 rounded-[16px] border border-white/8 bg-white/5 px-3 py-3"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {user.displayName}
                      </div>
                      <div className="text-xs text-emerald-300">online</div>
                    </div>
                    <span className="ui-pill">{user.accessRole ?? "user"}</span>
                  </div>
                ))}
              </div>
            )}
          </ChatPanelCard>
        </div>
      </aside>
    </div>
  );
}
