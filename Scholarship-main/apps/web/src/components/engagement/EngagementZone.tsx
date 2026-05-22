"use client";

import AnnouncementOutlet, {
  type Announcement,
} from "@/components/announcement/AnnouncementOutlet";
import ConfiguredCtaList from "@/components/cta/ConfiguredCtaList";

type PublicCta = {
  id: string;
  label: string;
  kind: "link" | "action";
  url: string | null;
  variant: string | null;
  placement?: string | null;
};

type EngagementZoneProps = {
  title: string;
  description?: string;
  announcements: Announcement[];
  ctas: PublicCta[];
  variant?: "workspace" | "admin" | "compact";
  emptyLabel?: string;
};

export default function EngagementZone({
  title,
  description,
  announcements,
  ctas,
  variant = "workspace",
  emptyLabel,
}: EngagementZoneProps) {
  const hasAnnouncements = announcements.length > 0;
  const hasCtas = ctas.length > 0;
  const hasContent = hasAnnouncements || hasCtas;

  if (!hasContent && !emptyLabel) return null;

  return (
    <section
      className={`ui-engagement-zone ui-engagement-zone--${variant}`}
      aria-label={title}
    >
      <div className="ui-engagement-zone__header">
        <div className="min-w-0">
          <div className="ui-engagement-zone__eyebrow">UI/UX operativo</div>
          <h2 className="ui-engagement-zone__title">{title}</h2>
          {description ? (
            <p className="ui-engagement-zone__description">{description}</p>
          ) : null}
        </div>
        <div className="ui-engagement-zone__meta" aria-hidden="true">
          {announcements.length} comunicados / {ctas.length} CTAs
        </div>
      </div>

      {hasContent ? (
        <div className="ui-engagement-zone__grid">
          <div className="ui-engagement-zone__column">
            <div className="ui-engagement-zone__column-title">Comunicados</div>
            {hasAnnouncements ? (
              <AnnouncementOutlet
                announcements={announcements}
                appearance="zone"
                className="ui-engagement-zone__stack"
              />
            ) : (
              <div className="ui-engagement-zone__empty">
                Sin comunicados activos para esta ubicación.
              </div>
            )}
          </div>

          <div className="ui-engagement-zone__column">
            <div className="ui-engagement-zone__column-title">CTAs</div>
            {hasCtas ? (
              <ConfiguredCtaList
                ctas={ctas}
                appearance="zone"
                className="ui-engagement-zone__actions"
              />
            ) : (
              <div className="ui-engagement-zone__empty">
                Sin accesos directos configurados para esta ubicación.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="ui-engagement-zone__empty">{emptyLabel}</div>
      )}
    </section>
  );
}
