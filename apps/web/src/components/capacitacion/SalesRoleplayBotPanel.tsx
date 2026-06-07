"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ChatPanelCard } from "@/components/ui/chat-workspace";
import {
  getRoleplayBotReply,
  listRoleplayBots,
  type RoleplayBotId,
  type RoleplayBotReply,
} from "@/lib/sales-roleplay-bots";

type BotPanelMessage = {
  id: string;
  content: string;
  sender: {
    userId: string;
    displayName: string;
  };
};

type SalesRoleplayBotPanelProps = {
  activeChatId: string | null;
  canUseComposer: boolean;
  messages: BotPanelMessage[];
  scenario: string;
  viewerUserId: string | null;
  onUseResponse: (response: string) => void;
};

type RequestState = {
  kind: "idle" | "loading" | "success" | "error";
  message: string;
};

export default function SalesRoleplayBotPanel({
  activeChatId,
  canUseComposer,
  messages,
  scenario,
  viewerUserId,
  onUseResponse,
}: SalesRoleplayBotPanelProps) {
  const bots = useMemo(() => listRoleplayBots(), []);
  const [selectedBotId, setSelectedBotId] = useState<RoleplayBotId>("closing");
  const [advisorDrafts, setAdvisorDrafts] = useState<Record<string, string>>({});
  const [extraKnowledge, setExtraKnowledge] = useState("");
  const [autoRespond, setAutoRespond] = useState(true);
  const [isAutoReplying, setIsAutoReplying] = useState(false);
  const [replyState, setReplyState] = useState<{
    signature: string;
    reply: RoleplayBotReply;
  } | null>(null);
  const [requestState, setRequestState] = useState<RequestState>({ kind: "idle", message: "" });
  const autoReplyBaselineByChatRef = useRef<Record<string, string>>({});
  const lastAutoReplyMessageIdRef = useRef("");

  const lastAdvisorMessage = useMemo(
    () => findLastAdvisorMessage(messages, viewerUserId),
    [messages, viewerUserId],
  );

  const draftKey = activeChatId ?? "no-chat";
  const advisorMessage = advisorDrafts[draftKey] ?? lastAdvisorMessage?.content ?? "";
  const replySignature = [draftKey, selectedBotId, advisorMessage, extraKnowledge, messages.length].join("::");
  const reply = replyState?.signature === replySignature ? replyState.reply : null;

  useEffect(() => {
    if (!activeChatId) return;
    const lastMessage = messages.at(-1);
    if (!lastMessage) {
      autoReplyBaselineByChatRef.current[activeChatId] = "";
      return;
    }

    const lastMessageId = lastMessage.id;
    const lastMessageContent = lastMessage.content;
    const lastMessageSenderUserId = lastMessage.sender.userId;

    const baseline = autoReplyBaselineByChatRef.current[activeChatId];
    if (baseline === undefined) {
      autoReplyBaselineByChatRef.current[activeChatId] = lastMessageId;
      return;
    }

    if (!autoRespond || !canUseComposer || !viewerUserId) return;
    if (lastMessageId === baseline || lastMessageSenderUserId !== viewerUserId) {
      autoReplyBaselineByChatRef.current[activeChatId] = lastMessageId;
      return;
    }
    if (lastAutoReplyMessageIdRef.current === lastMessageId) return;

    lastAutoReplyMessageIdRef.current = lastMessageId;
    autoReplyBaselineByChatRef.current[activeChatId] = lastMessageId;
    let cancelled = false;

    async function sendAutomaticBotReply() {
      setIsAutoReplying(true);
      try {
        const payload = await readJson<{ reply: RoleplayBotReply }>(
          `/api/capacitacion/chats/${activeChatId}/bots/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              botId: selectedBotId,
              advisorMessage: lastMessageContent,
              extraKnowledge,
            }),
          },
        );
        if (cancelled) return;
        setReplyState({
          signature: [draftKey, selectedBotId, lastMessageContent, extraKnowledge, messages.length].join("::"),
          reply: payload.reply,
        });
        setRequestState({ kind: "success", message: "Respuesta automática enviada por el bot." });
      } catch (error) {
        if (cancelled) return;
        setRequestState({
          kind: "error",
          message: error instanceof Error ? error.message : "No se pudo enviar la respuesta automática.",
        });
      } finally {
        if (!cancelled) setIsAutoReplying(false);
      }
    }

    void sendAutomaticBotReply();
    return () => {
      cancelled = true;
    };
  }, [
    activeChatId,
    autoRespond,
    canUseComposer,
    draftKey,
    extraKnowledge,
    messages,
    selectedBotId,
    viewerUserId,
  ]);

  function generateReply() {
    const trimmedMessage = advisorMessage.trim();
    if (!trimmedMessage) return;
    setReplyState({
      signature: replySignature,
      reply: getRoleplayBotReply({
        botId: selectedBotId,
        advisorMessage: trimmedMessage,
        scenario,
        extraKnowledge,
        turnIndex: messages.length,
      }),
    });
  }

  async function addBotToChat() {
    if (!activeChatId) return;
    setRequestState({ kind: "loading", message: "Agregando bot al chat..." });
    try {
      await readJson(`/api/capacitacion/chats/${activeChatId}/bots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId: selectedBotId }),
      });
      setRequestState({ kind: "success", message: "Bot agregado como participante." });
    } catch (error) {
      setRequestState({
        kind: "error",
        message: error instanceof Error ? error.message : "No se pudo agregar el bot.",
      });
    }
  }

  async function respondAsBot() {
    const trimmedMessage = advisorMessage.trim();
    if (!activeChatId || !trimmedMessage) return;
    setRequestState({ kind: "loading", message: "Generando respuesta del bot..." });
    try {
      const payload = await readJson<{ reply: RoleplayBotReply }>(`/api/capacitacion/chats/${activeChatId}/bots/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botId: selectedBotId,
          advisorMessage: trimmedMessage,
          extraKnowledge,
        }),
      });
      setReplyState({ signature: replySignature, reply: payload.reply });
      setRequestState({ kind: "success", message: "El bot respondió dentro del chat." });
    } catch (error) {
      setRequestState({
        kind: "error",
        message: error instanceof Error ? error.message : "No se pudo enviar la respuesta del bot.",
      });
    }
  }

  return (
    <ChatPanelCard title="Bots de roleplay">
      <div className="ui-chat-mini-form">
        <div className="ui-chat-filter-row" role="tablist" aria-label="Bot de roleplay">
          {bots.map((bot) => (
            <button
              key={bot.id}
              type="button"
              onClick={() => setSelectedBotId(bot.id)}
              className={[
                "ui-chat-filter",
                selectedBotId === bot.id ? "ui-chat-filter--active" : "",
              ].join(" ")}
              aria-selected={selectedBotId === bot.id}
              role="tab"
              title={bot.name}
            >
              {bot.shortLabel}
            </button>
          ))}
        </div>

        <p className="ui-chat-copy">
          Agrega el bot como participante para que el asesor practique contra una persona simulada. Con respuesta automática activa, el bot contesta solo después de cada mensaje del asesor.
        </p>

        <label className="ui-chat-checkbox">
          <input
            type="checkbox"
            checked={autoRespond}
            onChange={(event) => setAutoRespond(event.target.checked)}
          />
          Respuesta automática
          {isAutoReplying ? <span className="text-slate-300"> · respondiendo...</span> : null}
        </label>

        <textarea
          value={advisorMessage}
          onChange={(event) =>
            setAdvisorDrafts((current) => ({
              ...current,
              [draftKey]: event.target.value,
            }))
          }
          className="ui-chat-field min-h-[84px]"
          placeholder="Mensaje del asesor"
        />

        <textarea
          value={extraKnowledge}
          onChange={(event) => setExtraKnowledge(event.target.value)}
          className="ui-chat-field min-h-[76px]"
          placeholder="Conocimiento extra: tema - detalle"
        />

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={addBotToChat}
            disabled={!activeChatId}
            className="ui-chat-button ui-chat-button--secondary"
          >
            Agregar al chat
          </button>
          <button
            type="button"
            onClick={respondAsBot}
            disabled={!activeChatId || !advisorMessage.trim()}
            className="ui-chat-button"
          >
            Responder como bot
          </button>
        </div>

        <button
          type="button"
          onClick={generateReply}
          disabled={!advisorMessage.trim()}
          className="ui-chat-button ui-chat-button--secondary"
        >
          Generar objeción local
        </button>

        {requestState.kind !== "idle" && requestState.message ? (
          <p
            className={[
              "text-xs leading-5",
              requestState.kind === "error" ? "text-rose-200" : "text-slate-300",
            ].join(" ")}
          >
            {requestState.message}
          </p>
        ) : null}

        {reply ? (
          <div className="rounded-[16px] border border-white/8 bg-white/5 p-3">
            <div className="flex flex-wrap gap-2">
              <span className="ui-pill">{reply.detectedObjection}</span>
              <span className="ui-pill">
                {reply.intent === "moves_to_close" ? "mueve cierre" : "resiste"}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-100">{reply.text}</p>
            {reply.usedKnowledge ? (
              <p className="mt-2 text-xs leading-5 text-slate-300">Base: {reply.usedKnowledge}</p>
            ) : null}
            <button
              type="button"
              onClick={() => onUseResponse(reply.text)}
              disabled={!canUseComposer}
              className="ui-chat-button ui-chat-button--secondary mt-3"
            >
              Usar en composer
            </button>
          </div>
        ) : null}
      </div>
    </ChatPanelCard>
  );
}

async function readJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, { cache: "no-store", ...init });
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? "La operación no se pudo completar.");
  }
  return payload as T;
}

function findLastAdvisorMessage(messages: BotPanelMessage[], viewerUserId: string | null) {
  const usableMessages = messages.filter((message) => message.content.trim());
  const viewerMessage = [...usableMessages]
    .reverse()
    .find((message) => message.sender.userId === viewerUserId);
  return viewerMessage ?? usableMessages.at(-1) ?? null;
}
