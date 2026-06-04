"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type RequestState = "idle" | "loading" | "success" | "error";
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};
type Recommendation = {
  id: string;
  priority: "alta" | "media" | "baja";
  title: string;
  summary: string;
  nextAction: string;
};
type AssistantContext = {
  rateLimitStore: string;
  rateLimitShared: boolean;
  quoteEngineStatus: string;
  activeOfferings: number;
  lastImportStatus: string;
  lastImportErrors: number;
  recentAuditEvents: number;
};
type ActionPreview = {
  actionId: string;
  title: string;
  summary: string;
  risk: "baja";
  requiresConfirmation: boolean;
  confirmationText: string;
};

const PANEL_CLASS =
  "rounded-2xl border border-[color:var(--admin-shell-border)] bg-white p-4 shadow-sm";
const EYEBROW_CLASS =
  "text-xs font-black uppercase tracking-[0.14em] text-[color:var(--admin-shell-muted)]";
const TITLE_CLASS = "mt-1 text-2xl font-black text-[color:var(--admin-shell-ink)]";
const COPY_CLASS =
  "mt-1 max-w-3xl text-sm leading-6 text-[color:var(--admin-shell-muted)]";
const SECTION_TITLE_CLASS =
  "text-base font-black text-[color:var(--admin-shell-ink)]";
const SUCCESS_MESSAGE_CLASS =
  "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800";
const ERROR_MESSAGE_CLASS =
  "rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800";

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!response.ok) throw new Error(payload?.error ?? "La operacion fallo.");
  return payload as T;
}

function priorityClass(priority: Recommendation["priority"]) {
  if (priority === "alta") return "ui-admin-chip ui-admin-chip--danger";
  if (priority === "media") return "ui-admin-chip ui-admin-chip--warn";
  return "ui-admin-chip ui-admin-chip--success";
}

function makeMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return {
    id: `${role}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
  };
}

export default function OperationsAssistantPanel() {
  const [state, setState] = useState<RequestState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [context, setContext] = useState<AssistantContext | null>(null);
  const [preview, setPreview] = useState<ActionPreview | null>(null);
  const [note, setNote] = useState("");
  const [confirmationText, setConfirmationText] = useState("");

  const chatPayload = useMemo(
    () =>
      chatMessages.map((entry) => ({
        role: entry.role,
        content: entry.content,
      })),
    [chatMessages],
  );

  const refreshCapabilities = useCallback(async () => {
    try {
      const payload = await readJson<{
        capabilities: { actions: string[] };
      }>("/api/assistant/operations/capabilities");
      setCapabilities(payload.capabilities.actions ?? []);
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cargar capacidades.",
      );
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refreshCapabilities(), 0);
    return () => window.clearTimeout(timeout);
  }, [refreshCapabilities]);

  async function sendChat() {
    const content = chatInput.trim();
    if (!content) return;
    const nextUserMessage = makeMessage("user", content);
    const nextMessages = [...chatMessages, nextUserMessage];
    setChatMessages(nextMessages);
    setChatInput("");
    setState("loading");
    setMessage(null);
    try {
      const payload = await readJson<{
        reply: string;
        recommendations: Recommendation[];
        context: AssistantContext;
        ai: { ok: true; model: string } | { ok: false; code: string; error: string };
      }>("/api/assistant/operations/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...chatPayload,
            { role: nextUserMessage.role, content: nextUserMessage.content },
          ],
        }),
      });
      setChatMessages((current) => [
        ...current,
        makeMessage("assistant", payload.reply),
      ]);
      setRecommendations(payload.recommendations ?? []);
      setContext(payload.context ?? null);
      setState("success");
      setMessage(
        payload.ai.ok
          ? `Asistente respondió con ${payload.ai.model}.`
          : "Asistente respondió con fallback local.",
      );
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "No se pudo ejecutar el chat.",
      );
    }
  }

  async function createPreview() {
    const trimmedNote = note.trim();
    if (!trimmedNote) {
      setState("error");
      setMessage("Agrega una nota operativa.");
      return;
    }
    setState("loading");
    setMessage(null);
    try {
      const payload = await readJson<{ preview: ActionPreview }>(
        "/api/assistant/operations/action-preview",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actionId: "create_audit_note",
            payload: { note: trimmedNote },
          }),
        },
      );
      setPreview(payload.preview);
      setState("success");
      setMessage("Vista previa lista.");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "No se pudo crear preview.",
      );
    }
  }

  async function confirmAction() {
    if (!preview) return;
    setState("loading");
    setMessage(null);
    try {
      await readJson("/api/assistant/operations/action-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: preview.actionId,
          confirmationText,
          payload: { note: note.trim() },
        }),
      });
      setState("success");
      setMessage("Accion registrada.");
      setPreview(null);
      setNote("");
      setConfirmationText("");
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof Error ? error.message : "No se pudo confirmar accion.",
      );
    }
  }

  return (
    <div className="grid gap-4">
      <section className={PANEL_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className={EYEBROW_CLASS}>Operaciones</div>
            <h1 className={TITLE_CLASS}>Asistente operativo</h1>
            <p className={COPY_CLASS}>
              Chat cotidiano para priorizar procesos, revisar señales del sistema y
              registrar notas no destructivas.
            </p>
          </div>
          <button
            className="ui-admin-action ui-admin-action--secondary"
            type="button"
            onClick={() => void refreshCapabilities()}
            disabled={state === "loading"}
          >
            Sincronizar
          </button>
        </div>
        {message ? (
          <p
            className={
              state === "error"
                ? `${ERROR_MESSAGE_CLASS} mt-3`
                : `${SUCCESS_MESSAGE_CLASS} mt-3`
            }
          >
            {message}
          </p>
        ) : null}
      </section>

      <section className={PANEL_CLASS}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="ui-admin-chip">
            Acciones: {capabilities.length || "sincronizando"}
          </span>
          <span
            className={
              context?.rateLimitShared
                ? "ui-admin-chip ui-admin-chip--success"
                : "ui-admin-chip ui-admin-chip--warn"
            }
          >
            Rate limit: {context?.rateLimitStore ?? "pendiente"}
          </span>
          <span className="ui-admin-chip">
            Cotizador: {context?.quoteEngineStatus ?? "pendiente"}
          </span>
          <span className="ui-admin-chip">
            Oferta activa: {context?.activeOfferings ?? "pendiente"}
          </span>
        </div>
      </section>

      <section className={PANEL_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Chat</h2>
        <div className="mt-4 grid gap-3">
          <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
            {chatMessages.length === 0 ? (
              <p className="text-sm text-[color:var(--admin-shell-muted)]">
                Pregunta por prioridades del dia, importaciones, cotizador o auditor.
              </p>
            ) : (
              <div className="grid gap-3">
                {chatMessages.map((entry) => (
                  <article
                    key={entry.id}
                    className={
                      entry.role === "user"
                        ? "ml-auto max-w-[82%] rounded-xl bg-[color:var(--admin-shell-ink)] px-3 py-2 text-sm text-white"
                        : "max-w-[82%] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-[color:var(--admin-shell-ink)]"
                    }
                  >
                    {entry.content}
                  </article>
                ))}
              </div>
            )}
          </div>
          <textarea
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                void sendChat();
              }
            }}
            className="ui-admin-input min-h-[96px]"
            placeholder="Revisa mis prioridades operativas de hoy"
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="ui-admin-action"
              type="button"
              onClick={() => void sendChat()}
              disabled={!chatInput.trim() || state === "loading"}
            >
              Enviar
            </button>
          </div>
        </div>
      </section>

      <section className={PANEL_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Recomendaciones</h2>
        {recommendations.length === 0 ? (
          <p className={COPY_CLASS}>Ejecuta el chat para cargar señales operativas.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {recommendations.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-[color:var(--admin-shell-ink)]">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm text-[color:var(--admin-shell-muted)]">
                      {item.summary}
                    </p>
                  </div>
                  <span className={priorityClass(item.priority)}>
                    {item.priority}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-[color:var(--admin-shell-ink)]">
                  {item.nextAction}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={PANEL_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Acción confirmable</h2>
        <div className="mt-4 grid gap-3">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="ui-admin-input min-h-[92px]"
            placeholder="Nota operativa"
          />
          <div className="flex flex-wrap gap-2">
            <button
              className="ui-admin-action ui-admin-action--secondary"
              type="button"
              onClick={() => void createPreview()}
              disabled={state === "loading" || !note.trim()}
            >
              Preview
            </button>
          </div>
          {preview ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-black text-[color:var(--admin-shell-ink)]">
                {preview.title}
              </div>
              <p className="mt-1 text-sm text-[color:var(--admin-shell-muted)]">
                {preview.summary}
              </p>
              <input
                value={confirmationText}
                onChange={(event) => setConfirmationText(event.target.value)}
                className="ui-admin-input mt-3"
                placeholder={preview.confirmationText}
              />
              <button
                className="ui-admin-action mt-3"
                type="button"
                onClick={() => void confirmAction()}
                disabled={state === "loading"}
              >
                Confirmar
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
