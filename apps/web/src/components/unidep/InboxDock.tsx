"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  lastMessageSender: Identity | null;
  participants: Identity[];
};

type InboxThreadsPayload = {
  threads?: ThreadSummary[];
  viewer?: Identity;
};

class InboxNotificationRequestError extends Error {
  status: number;

  constructor(status: number) {
    super("inbox_notification_request_failed");
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

function notificationTitle(thread: ThreadSummary, viewer?: Identity | null) {
  const sender = thread.lastMessageSender;
  if (sender && sender.userId !== viewer?.userId) {
    return `Mensaje nuevo de ${sender.displayName}`;
  }

  return "Nueva notificación";
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

  if (!response.ok) throw new InboxNotificationRequestError(response.status);
  return (await response.json()) as InboxThreadsPayload;
}

export default function InboxDock() {
  const [isOpen, setIsOpen] = useState(false);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [viewer, setViewer] = useState<Identity | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );

  const applyThreadsPayload = useCallback((payload: InboxThreadsPayload) => {
    setThreads(payload.threads ?? []);
    setViewer(payload.viewer ?? null);
    setStatus("ready");
  }, []);

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

  const notifications = useMemo(
    () =>
      [...threads]
        .filter((thread) => {
          if (!thread.lastMessagePreview || !thread.lastMessageSender) return false;
          return thread.lastMessageSender.userId !== viewer?.userId;
        })
        .sort((left, right) => {
          const leftTime = left.lastMessageAt ?? left.updatedAt;
          const rightTime = right.lastMessageAt ?? right.updatedAt;
          return new Date(rightTime).getTime() - new Date(leftTime).getTime();
        })
        .slice(0, 4),
    [threads, viewer?.userId],
  );

  return (
    <aside className="ui-inbox-dock" aria-label="Notificaciones flotantes">
      {isOpen ? (
        <div className="ui-inbox-dock__panel">
          <div className="ui-inbox-dock__head">
            <div>
              <div className="ui-inbox-dock__title">Notificaciones</div>
              <div className="ui-inbox-dock__copy">
                {status === "loading"
                  ? "Actualizando notificaciones"
                  : `${notifications.length} notificaciones`}
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
            {notifications.length ? (
              notifications.map((thread) => {
                const title = notificationTitle(thread, viewer);
                return (
                  <Link
                    key={thread.id}
                    href={`/unidep/inbox/${thread.id}`}
                    className="ui-inbox-dock__thread"
                  >
                    <span className="ui-inbox-dock__avatar">{avatarLabel(title)}</span>
                    <span className="ui-inbox-dock__thread-main">
                      <span className="ui-inbox-dock__thread-title">{title}</span>
                      <span className="ui-inbox-dock__thread-preview">
                        {thread.lastMessagePreview}
                      </span>
                      <span className="ui-inbox-dock__thread-preview">
                        {threadTitle(thread, viewer)}
                      </span>
                    </span>
                    <span className="ui-inbox-dock__time">
                      {formatTime(thread.lastMessageAt)}
                    </span>
                  </Link>
                );
              })
            ) : (
              <div className="ui-inbox-dock__empty">
                {status === "error"
                  ? "Inbox no disponible en este momento."
                  : "No tienes notificaciones pendientes."}
              </div>
            )}
          </div>

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
        aria-label="Abrir notificaciones flotantes"
        aria-keyshortcuts="Control+I Meta+I Escape"
      >
        <span>Inbox</span>
        {notifications.length ? (
          <span className="ui-inbox-dock__badge">{notifications.length}</span>
        ) : null}
      </button>
    </aside>
  );
}
