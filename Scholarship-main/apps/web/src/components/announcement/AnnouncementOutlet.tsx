"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export type Announcement = {
  id: string;
  title: string;
  message: string;
  display: "banner" | "popout";
  url: string | null;
  buttonLabel: string | null;
  variant: string | null;
  visibilityRule?: {
    sessionStartOnly?: boolean | null;
    maxViews?: number | null;
  } | null;
};

const SESSION_KEY = "recalc.announcement.dismissed";
const SHOWN_SESSION_KEY = "recalc.announcement.shown";
const VIEW_KEY = "recalc.announcement.views";
type AnnouncementAppearance = "default" | "zone" | "compact";

function readStringArrayFromSessionStorage(key: string) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function readViewCountsFromLocalStorage() {
  if (typeof window === "undefined") return {} as Record<string, number>;
  try {
    const raw = window.localStorage.getItem(VIEW_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .map(([key, value]) => [key, Number(value)])
        .filter(([, value]) => Number.isFinite(value)),
    );
  } catch {
    return {};
  }
}

function handleAction(url: string, router: ReturnType<typeof useRouter>) {
  if (url.startsWith("/")) return router.push(url);
  if (url.startsWith("#")) {
    const el = document.getElementById(url.slice(1));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (url.startsWith("mailto:") || url.startsWith("tel:")) {
    window.location.href = url;
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function AnnouncementCard({
  item,
  appearance = "default",
}: {
  item: Announcement;
  appearance?: AnnouncementAppearance;
}) {
  const router = useRouter();
  const tone =
    item.variant === "primary"
      ? "ui-announcement-card--primary"
      : "ui-announcement-card--neutral";

  return (
    <article className={`ui-announcement-card ui-announcement-card--${appearance} ${tone}`}>
      <div className="ui-announcement-card__title">{item.title}</div>
      <p className="ui-announcement-card__message">{item.message}</p>
      {item.url ? (
        <div className="ui-announcement-card__action">
          {item.url.startsWith("/") ? (
            <Link href={item.url} className="ui-announcement-card__link">
              {item.buttonLabel ?? "Ver más"}
            </Link>
          ) : (
            <button
              type="button"
              className="ui-announcement-card__link"
              onClick={() => handleAction(item.url!, router)}
            >
              {item.buttonLabel ?? "Ver más"}
            </button>
          )}
        </div>
      ) : null}
    </article>
  );
}

export default function AnnouncementOutlet({
  announcements,
  className = "grid gap-2",
  appearance = "default",
}: {
  announcements: Announcement[];
  className?: string;
  appearance?: AnnouncementAppearance;
}) {
  const banners = useMemo(
    () => announcements.filter((item) => item.display === "banner"),
    [announcements]
  );
  const popouts = useMemo(
    () => announcements.filter((item) => item.display === "popout"),
    [announcements]
  );
  const [dismissedIds, setDismissedIds] = useState<string[]>(() =>
    readStringArrayFromSessionStorage(SESSION_KEY),
  );
  const [shownSessionIds, setShownSessionIds] = useState<string[]>(() =>
    readStringArrayFromSessionStorage(SHOWN_SESSION_KEY),
  );
  const [viewCounts, setViewCounts] = useState<Record<string, number>>(() =>
    readViewCountsFromLocalStorage(),
  );

  const activePopout =
    popouts.find((item) => {
      const sessionStartOnly = item.visibilityRule?.sessionStartOnly === true;
      const maxViews =
        typeof item.visibilityRule?.maxViews === "number" &&
        Number.isFinite(item.visibilityRule.maxViews) &&
        item.visibilityRule.maxViews > 0
          ? Math.trunc(item.visibilityRule.maxViews)
          : null;
      if (dismissedIds.includes(item.id)) return false;
      if (sessionStartOnly && shownSessionIds.includes(item.id)) return false;
      if (maxViews !== null && (viewCounts[item.id] ?? 0) >= maxViews) return false;
      return true;
    }) ?? null;

  useEffect(() => {
    if (!activePopout || activePopout.visibilityRule?.sessionStartOnly !== true) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShownSessionIds((current) => {
      if (current.includes(activePopout.id)) return current;
      const next = [...current, activePopout.id];
      try {
        window.sessionStorage.setItem(SHOWN_SESSION_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [activePopout]);

  useEffect(() => {
    if (!activePopout) return;
    const maxViews =
      typeof activePopout.visibilityRule?.maxViews === "number" &&
      Number.isFinite(activePopout.visibilityRule.maxViews) &&
      activePopout.visibilityRule.maxViews > 0
        ? Math.trunc(activePopout.visibilityRule.maxViews)
        : null;
    if (maxViews === null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViewCounts((current) => {
      const nextValue = (current[activePopout.id] ?? 0) + 1;
      const next = { ...current, [activePopout.id]: nextValue };
      try {
        window.localStorage.setItem(VIEW_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, [activePopout]);

  const dismissPopout = (id: string) => {
    setDismissedIds((current) => {
      if (current.includes(id)) return current;
      const next = [...current, id];
      try {
        window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  if (!announcements.length) return null;

  return (
    <>
      {banners.length ? (
        <div className={className}>
          {banners.map((item) => (
            <AnnouncementCard key={item.id} item={item} appearance={appearance} />
          ))}
        </div>
      ) : null}

      {activePopout ? (
        <div className="ui-announcement-popout">
          <div className="ui-announcement-popout__panel">
            <div className="ui-announcement-popout__header">
              <div className="ui-announcement-popout__eyebrow">Comunicado</div>
              <button
                type="button"
                onClick={() => {
                  if (!activePopout) return;
                  dismissPopout(activePopout.id);
                }}
                className="ui-announcement-popout__close"
              >
                Cerrar
              </button>
            </div>
            <div className="ui-announcement-popout__body">
              <AnnouncementCard item={activePopout} appearance="zone" />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
