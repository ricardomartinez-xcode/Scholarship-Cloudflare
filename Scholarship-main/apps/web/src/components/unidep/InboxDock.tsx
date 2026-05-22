"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Identity = {
  userId: string;
  displayName: string;
  email: string;
};

type ThreadSummary = {
  id: string;
  subject: string | null;
  updatedAt: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  participants: Identity[];
};

type InboxThreadsPayload = {
  threads?: ThreadSummary[];
  viewer?: Identity;
};

class QuickMessageRequestError extends Error {
  status: number;

  constructor(status: number) {
    super("quick_message_request_failed");
    this.status = status;
  }
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

function threadTitle(thread: ThreadSummary, viewer?: Identity | null) {
  const peerNames = thread.participants
    .filter((participant) => participant.userId !== viewer?.userId)
    .map((participant) => participant.displayName);

  return thread.subject || peerNames.join(" • ") || "Conversación interna";
}

function formatTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function fetchInboxThreads() {
  const response = await fetch("/api/unidep/inbox/threads", {
    cache: "no-store",
  });

  if (!response.ok) throw new QuickMessageRequestError(response.status);
  return (await response.json()) as InboxThreadsPayload;
}

export default function InboxDock() {
  const [isOpen, setIsOpen] = useState(false);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [viewer, setViewer] = useState<Identity | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [quickMessage, setQuickMessage] = useState("");
  const [isSendingQuickMessage, setIsSendingQuickMessage] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const quickReplyRef = useRef<HTMLTextAreaElement | null>(null);

  const applyThreadsPayload = useCallback((payload: InboxThreadsPayload) => {
    setThreads(payload.threads ?? []);
    setViewer(payload.viewer ?? null);
    setSelectedThreadId((current) =>
      current && (payload.threads ?? []).some((thread) => thread.id === current)
        ? current
        : payload.threads?.[0]?.id ?? "",
    );
    setStatus("ready");
  }, []);

  const refreshThreads = useCallback(async () => {
    const payload = await fetchInboxThreads();
    applyThreadsPayload(payload);
  }, [applyThreadsPayload]);

  useEffect(() => {
    let active = true;

    async function loadThreads() {
      setStatus("loading");
      try {
        const payload = await fetchInboxThreads();
        if (!active) return;
        applyThreadsPayload(payload);
      } catch {
        if (active) setStatus("error");
      }
    }

    loadThreads();
    const timer = window.setInterval(loadThreads, 60000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [applyThreadsPayload]);

  useEffect(() => {
    function toggleInbox() {
      setIsOpen((value) => !value);
    }

    function closeInbox() {
      setIsOpen(false);
    }

    window.addEventListener("workspace:toggle-inbox", toggleInbox);
    window.addEventListener("workspace:close-floating-panels", closeInbox);
    return () => {
      window.removeEventListener("workspace:toggle-inbox", toggleInbox);
      window.removeEventListener("workspace:close-floating-panels", closeInbox);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    window.requestAnimationFrame(() => {
      quickReplyRef.current?.focus();
    });
  }, [isOpen]);

  const visibleThreads = useMemo(
    () =>
      [...threads]
        .sort((left, right) => {
          const leftTime = left.lastMessageAt ?? left.updatedAt;
          const rightTime = right.lastMessageAt ?? right.updatedAt;
          return new Date(rightTime).getTime() - new Date(leftTime).getTime();
        })
        .slice(0, 4),
    [threads],
  );
  const selectedThread =
    visibleThreads.find((thread) => thread.id === selectedThreadId) ??
    visibleThreads[0] ??
    null;

  async function sendQuickMessage() {
    const content = quickMessage.trim();
    const threadId = selectedThread?.id;
    if (!content || !threadId || isSendingQuickMessage) return;

    const createdAt = new Date().toISOString();
    setIsSendingQuickMessage(true);
    setQuickMessage("");
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              lastMessageAt: createdAt,
              lastMessagePreview: content,
              updatedAt: createdAt,
            }
          : thread,
      ),
    );

    try {
      const response = await fetch(`/api/unidep/inbox/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new QuickMessageRequestError(response.status);
      void refreshThreads();
    } catch (sendError) {
      if (sendError instanceof QuickMessageRequestError && sendError.status < 500) {
        setQuickMessage(content);
      } else {
        void refreshThreads().catch(() => undefined);
      }
      setStatus("error");
    } finally {
      setIsSendingQuickMessage(false);
    }
  }

  return (
    <aside className="ui-inbox-dock" aria-label="Inbox flotante">
      {isOpen ? (
        <div className="ui-inbox-dock__panel">
          <div className="ui-inbox-dock__head">
            <div>
              <div className="ui-inbox-dock__title">Inbox</div>
              <div className="ui-inbox-dock__copy">
                {status === "loading"
                  ? "Actualizando conversaciones"
                  : `${visibleThreads.length} conversaciones rápidas`}
              </div>
            </div>
            <button
              type="button"
              className="ui-inbox-dock__collapse"
              onClick={() => setIsOpen(false)}
              aria-label="Contraer Inbox"
            >
              Contraer
            </button>
          </div>

          <div className="ui-inbox-dock__threads">
            {visibleThreads.length ? (
              visibleThreads.map((thread) => {
                const title = threadTitle(thread, viewer);
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={[
                      "ui-inbox-dock__thread",
                      thread.id === selectedThread?.id
                        ? "ui-inbox-dock__thread--active"
                        : "",
                    ].join(" ")}
                  >
                    <span className="ui-inbox-dock__avatar">{avatarLabel(title)}</span>
                    <span className="ui-inbox-dock__thread-main">
                      <span className="ui-inbox-dock__thread-title">{title}</span>
                      <span className="ui-inbox-dock__thread-preview">
                        {thread.lastMessagePreview || "Abrir conversación"}
                      </span>
                    </span>
                    <span className="ui-inbox-dock__time">
                      {formatTime(thread.lastMessageAt)}
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="ui-inbox-dock__empty">
                {status === "error"
                  ? "Inbox no disponible en este momento."
                  : "No hay conversaciones recientes."}
              </div>
            )}
          </div>

          {selectedThread ? (
            <div className="ui-inbox-dock__quick-reply">
              <textarea
                ref={quickReplyRef}
                value={quickMessage}
                onChange={(event) => setQuickMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    (!event.shiftKey || event.ctrlKey || event.metaKey) &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    void sendQuickMessage();
                  }
                }}
                placeholder="Responder rápido..."
                className="ui-inbox-dock__textarea"
                aria-keyshortcuts="Enter Control+Enter Meta+Enter Shift+Enter"
              />
              <div className="ui-inbox-dock__quick-actions">
                <Link
                  href={`/unidep/inbox/${selectedThread.id}`}
                  className="ui-inbox-dock__secondary"
                >
                  Abrir chat
                </Link>
                <button
                  type="button"
                  onClick={() => void sendQuickMessage()}
                  disabled={!quickMessage.trim() || isSendingQuickMessage}
                  className="ui-inbox-dock__send"
                  aria-keyshortcuts="Enter Control+Enter Meta+Enter"
                >
                  {isSendingQuickMessage ? "Enviando..." : "Enviar"}
                </button>
              </div>
            </div>
          ) : null}

          <Link href="/unidep/inbox" className="ui-inbox-dock__primary">
            Abrir Inbox completo
          </Link>
        </div>
      ) : null}

      <button
        type="button"
        className="ui-inbox-dock__rail"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-label="Abrir Inbox flotante"
        aria-keyshortcuts="Control+I Meta+I Escape"
      >
        <span>Inbox</span>
        {visibleThreads.length ? (
          <span className="ui-inbox-dock__badge">{visibleThreads.length}</span>
        ) : null}
      </button>
    </aside>
  );
}
