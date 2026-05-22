import type { ReactNode } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type ChatAvatarProps = {
  label: string;
  tone?: "default" | "accent" | "anonymous";
  online?: boolean;
};

export function ChatAvatar({
  label,
  tone = "default",
  online = false,
}: ChatAvatarProps) {
  return (
    <div className={cx("ui-chat-avatar", `ui-chat-avatar--${tone}`)}>
      <span>{label}</span>
      <span
        className={cx(
          "ui-chat-avatar__presence",
          online ? "ui-chat-avatar__presence--online" : "ui-chat-avatar__presence--offline",
        )}
      />
    </div>
  );
}

type ChatPanelCardProps = {
  title: string;
  children: ReactNode;
};

export function ChatPanelCard({ title, children }: ChatPanelCardProps) {
  return (
    <section className="ui-chat-panel-card">
      <div className="ui-chat-panel-card__title">{title}</div>
      {children}
    </section>
  );
}

type ChatEmptyStateProps = {
  title: string;
  copy: string;
  action?: ReactNode;
};

export function ChatEmptyState({ title, copy, action }: ChatEmptyStateProps) {
  return (
    <div className="ui-chat-empty">
      <div className="ui-chat-empty__title">{title}</div>
      <p className="ui-chat-empty__copy">{copy}</p>
      {action ? <div className="ui-chat-empty__action">{action}</div> : null}
    </div>
  );
}

export function ChatLoadingStack({ rows = 5 }: { rows?: number }) {
  return (
    <div className="ui-chat-loading-stack" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="ui-chat-skeleton" />
      ))}
    </div>
  );
}

type ChatMessageBubbleProps = {
  align: "in" | "out";
  author: string;
  timestamp: string;
  children: ReactNode;
};

export function ChatMessageBubble({
  align,
  author,
  timestamp,
  children,
}: ChatMessageBubbleProps) {
  return (
    <div className={cx("ui-chat-message-row", align === "out" && "ui-chat-message-row--out")}>
      <article
        className={cx(
          "ui-chat-message-bubble",
          align === "out" ? "ui-chat-message-bubble--out" : "ui-chat-message-bubble--in",
        )}
      >
        <div className="ui-chat-message-bubble__meta">
          <span>{author}</span>
          <span>{timestamp}</span>
        </div>
        <div className="ui-chat-message-bubble__body">{children}</div>
      </article>
    </div>
  );
}
