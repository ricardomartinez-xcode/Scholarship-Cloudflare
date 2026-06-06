"use client";

import { useMemo, useState } from "react";

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
  const [replyState, setReplyState] = useState<{
    signature: string;
    reply: RoleplayBotReply;
  } | null>(null);

  const lastAdvisorMessage = useMemo(
    () => findLastAdvisorMessage(messages, viewerUserId),
    [messages, viewerUserId],
  );

  const draftKey = activeChatId ?? "no-chat";
  const advisorMessage =
    advisorDrafts[draftKey] ?? lastAdvisorMessage?.content ?? "";
  const replySignature = [
    draftKey,
    selectedBotId,
    advisorMessage,
    extraKnowledge,
    messages.length,
  ].join("::");
  const reply =
    replyState?.signature === replySignature ? replyState.reply : null;

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

  return (
    <ChatPanelCard title="Bots de rolplay">
      <div className="ui-chat-mini-form">
        <div className="ui-chat-filter-row" role="tablist" aria-label="Bot de rolplay">
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
            >
              {bot.shortLabel}
            </button>
          ))}
        </div>

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
          placeholder="Conocimiento extra"
        />

        <button
          type="button"
          onClick={generateReply}
          disabled={!advisorMessage.trim()}
          className="ui-chat-button"
        >
          Generar objeción
        </button>

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
              <p className="mt-2 text-xs leading-5 text-slate-300">
                Base: {reply.usedKnowledge}
              </p>
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

function findLastAdvisorMessage(
  messages: BotPanelMessage[],
  viewerUserId: string | null,
) {
  const usableMessages = messages.filter((message) => message.content.trim());
  const viewerMessage = [...usableMessages]
    .reverse()
    .find((message) => message.sender.userId === viewerUserId);
  return viewerMessage ?? usableMessages.at(-1) ?? null;
}
