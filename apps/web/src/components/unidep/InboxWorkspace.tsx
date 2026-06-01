"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import SmartSelect from "@/components/SmartSelect";
import {
  ChatAvatar,
  ChatEmptyState,
  ChatLoadingStack,
  ChatMessageBubble,
} from "@/components/ui/chat-workspace";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useRealtimePresence } from "@/hooks/useRealtimePresence";
import { realtimeTopics } from "@/lib/realtime-topics";
import { subscribeToPrivateBroadcast } from "@/lib/supabase/client";

type Viewer = {
  userId: string;
  email: string;
  displayName: string;
};

type Identity = {
  userId: string;
  displayName: string;
  email: string;
};

type ThreadSummary = {
  id: string;
  subject: string | null;
  status: "active" | "archived";
  organizationId: string | null;
  organizationName: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  participantCount: number;
  participants: Identity[];
};

type MessageSummary = {
  id: string;
  threadId: string;
  content: string;
  createdAt: string;
  sender: Identity;
};

type EligibleUser = Identity;

type InboxNotice = {
  threadId: string;
  title: string;
  body: string;
};

class ApiRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function formatThreadTimestamp(value: string | null) {
  if (!value) return "Sin actividad";
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMessageTimestamp(value: string) {
  return new Date(value).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function threadTitle(thread: ThreadSummary, viewer?: Viewer | null) {
  const peerNames = thread.participants
    .filter((participant) => participant.userId !== viewer?.userId)
    .map((participant) => participant.displayName);
  return thread.subject || peerNames.join(" • ") || "Conversación interna";
}

function threadSubtitle(thread: ThreadSummary, viewer?: Viewer | null) {
  const peer = thread.participants.find(
    (participant) => participant.userId !== viewer?.userId,
  );
  return (
    peer?.email ||
    thread.organizationName ||
    thread.lastMessagePreview ||
    "Mensajería interna"
  );
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

async function readJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, { cache: "no-store", ...init });
  const payload = (await response.json().catch(() => null)) as (T & {
    error?: string;
  }) | null;
  if (!response.ok) {
    throw new ApiRequestError(
      payload?.error ?? "La operación no se pudo completar.",
      response.status,
    );
  }
  return payload as T;
}

export default function InboxWorkspace({
  initialThreadId = "",
}: {
  initialThreadId?: string;
}) {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [eligibleUsers, setEligibleUsers] = useState<EligibleUser[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState(initialThreadId);
  const [recipientUserId, setRecipientUserId] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [isRefreshingThreads, setIsRefreshingThreads] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadByThread, setUnreadByThread] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState<InboxNotice | null>(null);
  const defaultDocumentTitleRef = useRef("ReCalc");
  const handledRealtimeMessageIdsRef = useRef<Set<string>>(new Set());
  const selectedThreadIdRef = useRef(selectedThreadId);
  const viewerIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

  useEffect(() => {
    viewerIdRef.current = viewer?.userId ?? null;
  }, [viewer]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      defaultDocumentTitleRef.current = document.title;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadThreads() {
      try {
        const payload = await readJson<{
          viewer: Viewer;
          threads: ThreadSummary[];
          eligibleUsers: EligibleUser[];
        }>("/api/unidep/inbox/threads");
        if (cancelled) return;
        setViewer(payload.viewer);
        setThreads(payload.threads ?? []);
        setEligibleUsers(payload.eligibleUsers ?? []);
        setSelectedThreadId((current) =>
          current && payload.threads.some((thread) => thread.id === current)
            ? current
            : payload.threads[0]?.id ?? "",
        );
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudo cargar inbox.",
          );
        }
      }
    }

    void loadThreads();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeThread =
    threads.find((thread) => thread.id === selectedThreadId) ?? null;

  const { messages, setMessages, isLoading, error: messagesError } =
    useRealtimeMessages<MessageSummary>({
      fetchUrl: selectedThreadId
        ? `/api/unidep/inbox/threads/${selectedThreadId}/messages`
        : null,
      topic: selectedThreadId
        ? realtimeTopics.inboxThreadMessages(selectedThreadId)
        : null,
    });

  const presence = useRealtimePresence({
    topic: selectedThreadId
      ? realtimeTopics.inboxThreadPresence(selectedThreadId)
      : null,
    currentUser: viewer
      ? {
          userId: viewer.userId,
          displayName: viewer.displayName,
        }
      : null,
  });

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const unreadTotal = useMemo(
    () => Object.values(unreadByThread).reduce((sum, value) => sum + value, 0),
    [unreadByThread],
  );

  const visibleThreads = useMemo(() => {
    const normalizedQuery = deferredSearchTerm.trim().toLowerCase();
    return threads.filter((thread) => {
      if (!normalizedQuery) return true;
      const title = threadTitle(thread, viewer).toLowerCase();
      const preview = (thread.lastMessagePreview || "").toLowerCase();
      const organization = (thread.organizationName || "").toLowerCase();
      const subtitle = threadSubtitle(thread, viewer).toLowerCase();
      return [title, preview, organization, subtitle].some((value) =>
        value.includes(normalizedQuery),
      );
    });
  }, [deferredSearchTerm, threads, viewer]);

  const eligibleUserOptions = useMemo(
    () =>
      eligibleUsers.map((user) => ({
        value: user.userId,
        label: `${user.displayName} · ${user.email}`,
        keywords: `${user.displayName} ${user.email}`,
      })),
    [eligibleUsers],
  );

  const refreshThreads = useCallback(async () => {
    setIsRefreshingThreads(true);
    try {
      const payload = await readJson<{
        viewer: Viewer;
        threads: ThreadSummary[];
        eligibleUsers: EligibleUser[];
      }>("/api/unidep/inbox/threads");
      setViewer(payload.viewer);
      setThreads(payload.threads ?? []);
      setEligibleUsers(payload.eligibleUsers ?? []);
      setSelectedThreadId((current) =>
        current && payload.threads.some((thread) => thread.id === current)
          ? current
          : payload.threads[0]?.id ?? "",
      );
      setError(null);
    } finally {
      setIsRefreshingThreads(false);
    }
  }, []);

  const updateThreadPreview = useCallback(
    (threadId: string, content: string, createdAt: string) => {
      setThreads((current) =>
        current
          .map((thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  lastMessageAt: createdAt,
                  lastMessagePreview: content,
                  updatedAt: createdAt,
                }
              : thread,
          )
          .sort((left, right) => {
            const leftTime = left.lastMessageAt ?? left.updatedAt;
            const rightTime = right.lastMessageAt ?? right.updatedAt;
            return new Date(rightTime).getTime() - new Date(leftTime).getTime();
          }),
      );
    },
    [],
  );

  async function createThread() {
    if (!recipientUserId) return;
    setIsCreatingThread(true);
    try {
      const payload = await readJson<{ threadId: string }>(
        "/api/unidep/inbox/threads",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipientUserId }),
        },
      );
      setRecipientUserId("");
      await refreshThreads();
      setSelectedThreadId(payload.threadId);
      setError(null);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "No se pudo crear la conversación.",
      );
    } finally {
      setIsCreatingThread(false);
    }
  }

  async function sendMessage() {
    const content = messageInput.trim();
    const threadId = selectedThreadId;
    if (!threadId || !content || !viewer || isSendingMessage) return;

    const createdAt = new Date().toISOString();
    const optimisticMessage: MessageSummary = {
      id: `optimistic-${crypto.randomUUID()}`,
      threadId,
      content,
      createdAt,
      sender: viewer,
    };

    setIsSendingMessage(true);
    setMessageInput("");
    setError(null);
    setMessages((current) => [...current, optimisticMessage]);
    updateThreadPreview(threadId, content, createdAt);

    try {
      const payload = await readJson<{ message: MessageSummary }>(
        `/api/unidep/inbox/threads/${threadId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );
      handledRealtimeMessageIdsRef.current.add(payload.message.id);
      setMessages((current) => {
        const withoutOptimistic = current.filter(
          (message) => message.id !== optimisticMessage.id,
        );
        return withoutOptimistic.some((message) => message.id === payload.message.id)
          ? withoutOptimistic
          : [...withoutOptimistic, payload.message];
      });
      updateThreadPreview(threadId, payload.message.content, payload.message.createdAt);
      void refreshThreads();
    } catch (sendError) {
      const requestError =
        sendError instanceof ApiRequestError ? sendError : null;
      if (!requestError || requestError.status < 500) {
        setMessages((current) =>
          current.filter((message) => message.id !== optimisticMessage.id),
        );
        setMessageInput(content);
      } else {
        void refreshThreads();
      }
      setError(
        sendError instanceof Error
          ? sendError.message
          : "No se pudo enviar el mensaje.",
      );
    } finally {
      setIsSendingMessage(false);
    }
  }

  const participants =
    activeThread?.participants.filter(
      (participant) => participant.userId !== viewer?.userId,
    ) ?? [];
  const primaryParticipant = participants[0] ?? null;

  useEffect(() => {
    if (!selectedThreadId) return;
    setUnreadByThread((current) => {
      if (!current[selectedThreadId]) return current;
      const next = { ...current };
      delete next[selectedThreadId];
      return next;
    });
  }, [selectedThreadId]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = unreadTotal
      ? `(${unreadTotal}) Inbox | ${defaultDocumentTitleRef.current}`
      : defaultDocumentTitleRef.current;

    return () => {
      document.title = defaultDocumentTitleRef.current;
    };
  }, [unreadTotal]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      const activeId = selectedThreadIdRef.current;
      if (!activeId) return;
      setUnreadByThread((current) => {
        if (!current[activeId]) return current;
        const next = { ...current };
        delete next[activeId];
        return next;
      });
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!threads.length) return;

    const unsubscribers = threads.map((thread) =>
      subscribeToPrivateBroadcast<MessageSummary>({
        topic: realtimeTopics.inboxThreadMessages(thread.id),
        event: "new_message",
        onMessage: (message) => {
          const messageId = message.id;
          if (handledRealtimeMessageIdsRef.current.has(messageId)) {
            return;
          }
          handledRealtimeMessageIdsRef.current.add(messageId);
          if (handledRealtimeMessageIdsRef.current.size > 300) {
            const retainedIds = Array.from(
              handledRealtimeMessageIdsRef.current,
            ).slice(-180);
            handledRealtimeMessageIdsRef.current = new Set(retainedIds);
          }

          const isOwnMessage = message.sender.userId === viewerIdRef.current;
          if (isOwnMessage) {
            void refreshThreads();
            return;
          }

          const isCurrentThread = message.threadId === selectedThreadIdRef.current;
          const shouldCountAsUnread =
            !isCurrentThread || document.visibilityState !== "visible";

          if (shouldCountAsUnread) {
            setUnreadByThread((current) => ({
              ...current,
              [message.threadId]: (current[message.threadId] ?? 0) + 1,
            }));
            setNotice({
              threadId: message.threadId,
              title: message.sender.displayName,
              body: message.content,
            });
          }

          void refreshThreads();
        },
      }),
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe?.());
    };
  }, [refreshThreads, threads]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  return (
    <div className="ui-inbox-workspace">
      <aside className="ui-inbox-sidebar">
        <div className="ui-inbox-sidebar__head">
          <div>
            {/* Remove the kicker and explanatory copy for a streamlined sidebar */}
            <div className="ui-inbox-sidebar__title">Inbox</div>
          </div>
          {/* Notification bar and related messages removed per design spec */}

          <div className="ui-inbox-compose">
            <div className="ui-inbox-compose__field">
              <label className="ui-inbox-compose__label">
                Iniciar conversación
              </label>
              <SmartSelect
                value={recipientUserId}
                placeholder="Selecciona un contacto"
                options={eligibleUserOptions}
                onChange={setRecipientUserId}
                searchEnabled
                disabled={!eligibleUserOptions.length || isCreatingThread}
              />
            </div>
            <button
              type="button"
              onClick={() => void createThread()}
              disabled={!recipientUserId || isCreatingThread}
              className="ui-admin-action"
            >
              {isCreatingThread ? "Abriendo..." : "Abrir chat"}
            </button>
          </div>

          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="ui-chat-search"
            placeholder="Buscar por nombre, correo o mensaje"
            aria-label="Buscar conversaciones de Inbox"
            data-workspace-shortcut="search"
            aria-keyshortcuts="Control+K Meta+K /"
          />
        </div>

        <div className="ui-inbox-list">
          {error ? (
            <div className="ui-chat-empty">
              <div className="ui-chat-empty__title">No se pudo cargar inbox</div>
              <p className="ui-chat-empty__copy">{error}</p>
              <button
                type="button"
                className="ui-admin-action ui-admin-action--secondary"
                onClick={() => void refreshThreads()}
              >
                Reintentar
              </button>
            </div>
          ) : null}

          {!error && threads.length === 0 ? (
            /* omit instructional copy when there are no conversations */
            <ChatEmptyState
              title="Todavía no hay conversaciones"
              copy=""
            />
          ) : null}

          {!error && threads.length > 0 && visibleThreads.length === 0 ? (
            /* omit instructional copy when there are no search results */
            <ChatEmptyState
              title="No hay coincidencias"
              copy=""
            />
          ) : null}

          {!error &&
            visibleThreads.map((thread) => {
              const title = threadTitle(thread, viewer);
              // Omit subtitle to avoid explanatory or auxiliary text in the UI
              const syntheticUnread = unreadByThread[thread.id] ?? 0;

              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setSelectedThreadId(thread.id)}
                  className={[
                    "ui-inbox-thread",
                    thread.id === selectedThreadId ? "ui-inbox-thread--active" : "",
                  ].join(" ")}
                >
                  <ChatAvatar
                    label={avatarLabel(title)}
                    tone={thread.id === selectedThreadId ? "accent" : "default"}
                    online={thread.status === "active"}
                  />
                  <div className="ui-inbox-thread__stack">
                    <div className="ui-inbox-thread__row">
                      <div className="ui-inbox-thread__name">{title}</div>
                      <div className="ui-inbox-thread__time">
                        {formatThreadTimestamp(thread.lastMessageAt)}
                      </div>
                    </div>
                    {/* Removed subtitle element to simplify list items */}
                    <div className="ui-inbox-thread__preview">
                      {thread.lastMessagePreview || "Sin mensajes todavía."}
                    </div>
                  </div>
                  <div className="ui-inbox-thread__meta">
                    {syntheticUnread > 0 ? (
                      <span className="ui-inbox-thread__badge">
                        {syntheticUnread}
                      </span>
                    ) : null}
                    <span className="ui-admin-chip">
                      {thread.status === "active" ? "Activo" : "Archivado"}
                    </span>
                  </div>
                </button>
              );
            })}
        </div>
      </aside>

      <section className="ui-inbox-main">
        <header className="ui-inbox-main__head">
          {activeThread ? (
            <div className="ui-chat-main__contact">
              <ChatAvatar
                label={avatarLabel(threadTitle(activeThread, viewer))}
                tone="accent"
                online={activeThread.status === "active"}
              />
              <div>
                <div className="ui-chat-main__title">
                  {threadTitle(activeThread, viewer)}
                </div>
                {/* Show only participant or organization; omit fallback copy */}
                {primaryParticipant?.email || activeThread.organizationName ? (
                  <div className="ui-chat-main__copy">
                    {primaryParticipant?.email || activeThread.organizationName}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div>
              <div className="ui-chat-main__title">Selecciona un chat</div>
              {/* omit instructional copy on empty chat selection */}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refreshThreads()}
              className="ui-admin-action ui-admin-action--secondary"
              disabled={isRefreshingThreads}
            >
              {isRefreshingThreads ? "Actualizando..." : "Actualizar"}
            </button>
            <span className="ui-admin-chip ui-admin-chip--accent">
              {presence.onlineUsers.length} online
            </span>
            {unreadTotal > 0 ? (
              <span className="ui-admin-chip ui-admin-chip--warn">
                {unreadTotal} sin leer
              </span>
            ) : null}
          </div>
        </header>

        {notice ? (
          <div className="ui-inbox-notice">
            <div className="ui-inbox-notice__content">
              <div className="ui-inbox-notice__title">
                Nuevo mensaje de {notice.title}
              </div>
              <div className="ui-inbox-notice__body">{notice.body}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="ui-admin-action ui-admin-action--secondary"
                onClick={() => {
                  setSelectedThreadId(notice.threadId);
                  setNotice(null);
                }}
              >
                Abrir
              </button>
              <button
                type="button"
                className="ui-admin-action ui-admin-action--secondary"
                onClick={() => setNotice(null)}
              >
                Ocultar
              </button>
            </div>
          </div>
        ) : null}

        <div className="ui-inbox-main__messages">
          {activeThread ? (
            <>
              <div className="ui-chat-main__day">Hoy</div>
              {isLoading ? <ChatLoadingStack rows={6} /> : null}
              {messagesError ? (
                <ChatEmptyState
                  title="No se pudo cargar el historial"
                  copy={messagesError}
                />
              ) : null}
              {!isLoading && !messagesError && messages.length === 0 ? (
                /* omit instructional copy when no messages exist */
                <ChatEmptyState
                  title="Sin mensajes todavía"
                  copy=""
                />
              ) : null}
              {!isLoading &&
                !messagesError &&
                messages.map((message) => {
                  const isMine = message.sender.userId === viewer?.userId;
                  return (
                    <ChatMessageBubble
                      key={message.id}
                      align={isMine ? "out" : "in"}
                      author={message.sender.displayName}
                      timestamp={formatMessageTimestamp(message.createdAt)}
                    >
                      {message.content}
                    </ChatMessageBubble>
                  );
                })}
              <div ref={messagesEndRef} />
            </>
          ) : (
            /* omit instructional copy when no thread is selected */
            <ChatEmptyState
              title="Inbox listo para operar"
              copy=""
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
            disabled={!activeThread || activeThread.status !== "active"}
            className="ui-chat-composer__field"
            aria-label="Mensaje interno"
            aria-keyshortcuts="Enter Control+Enter Meta+Enter Shift+Enter"
            placeholder={
              activeThread
                ? "Escribe un mensaje interno..."
                : "Selecciona un chat para empezar"
            }
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={
              !activeThread ||
              !messageInput.trim() ||
              isSendingMessage ||
              activeThread.status !== "active"
            }
            className="ui-admin-action"
            aria-keyshortcuts="Enter Control+Enter Meta+Enter"
          >
            {isSendingMessage ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </section>
    </div>
  );
}
