"use client";

import { useEffect, useMemo, useState } from "react";

import {
  buildDirectoryContactHref,
  parseDirectoryContactMethods,
} from "@/lib/directory-contact-methods";
import AnnouncementOutlet, {
  type Announcement,
} from "@/components/announcement/AnnouncementOutlet";
import AgendaPanel from "@/components/unidep/AgendaPanel";
import ContactsPanel from "@/components/unidep/ContactsPanel";
import WebCampaignsPanel from "@/components/unidep/WebCampaignsPanel";
import WabaEmbeddedSignupSection from "@/components/unidep/WabaEmbeddedSignupSection";
import ScholarshipCalculator from "@/components/ScholarshipCalculator";
import SimulatorSidebarPanel from "@/components/simulator/SimulatorSidebarPanel";
import SmartSelect from "@/components/SmartSelect";
import { useAppContext } from "@/components/app/AppChrome";
import type { AcademicOfferCycle } from "@/config/academicOffer";
import { canAccessWorkspaceWhatsapp } from "@/lib/workspace-access";
import type { WhatsappTemplateCollection } from "@/lib/whatsapp-templates";
import { type WorkspaceSectionKey } from "@/lib/unidep-navigation";

type Campus = {
  id: string;
  code: string;
  metaKey: string;
  name: string;
  slug: string;
  tier?: string | null;
  kind: "campus" | "online";
  address?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
};

type OfertaProgram = {
  programId: string;
  name: string;
  category: string | null;
  businessLine: string | null;
  brochurePdfUrl: string | null;
  planPdfUrl: string | null;
  heroImageUrl: string | null;
  thumbnailImageUrl: string | null;
  planDownloadUrl: string | null;
  brochureDownloadUrl: string | null;
};

type OfertaOffering = {
  id: string;
  modality: string;
  schedule: string | null;
  planLink: string | null;
  planDownloadLink: string | null;
  campus?: {
    id: string;
    code: string;
    metaKey: string;
    name: string;
    slug: string;
    tier: string | null;
    kind: "campus" | "online";
  };
  program: {
    id: string;
    name: string;
  };
};

type PlanProgram = {
  id: string;
  name: string;
  category: string | null;
  businessLine: string | null;
  planPdfUrl: string | null;
  planDownloadUrl: string | null;
  heroImageUrl: string | null;
  thumbnailImageUrl: string | null;
  hasPlan: boolean;
};

type EnrollmentFormat = {
  id: string;
  title: string;
  description: string | null;
  fileName: string | null;
  fileUrl: string;
  fileMimeType: string | null;
  fileSizeBytes: number | null;
  sourceType: string;
  sortOrder: number;
};

type AcademicFee = {
  id: string;
  code: string;
  concept: string;
  costMxn: number;
  section: "EXAMENES" | "TRAMITES" | "DIVERSOS";
};

type DirectoryContact = {
  id: string;
  zone?: string | null;
  role?: string | null;
  name?: string | null;
  contact?: string | null;
  email?: string | null;
  source?: string | null;
  methods?: Array<{
    type: string;
    value: string;
    normalizedValue: string;
    isPrimary: boolean;
    sortOrder: number;
    href?: string | null;
  }>;
  campus: Campus;
};

const DIRECTORY_AREAS = [
  "Comercial",
  "Marketing",
  "Servicios Escolares",
  "Administrativos",
  "Asesores",
  "Orientadores",
] as const;

type PublicCta = {
  id: string;
  label: string;
  kind: "link" | "action";
  url: string | null;
  variant: string | null;
};

function isAdminPanelAnnouncement(item: Announcement) {
  const title = item.title.toLowerCase();
  const message = item.message.toLowerCase();
  const buttonLabel = (item.buttonLabel ?? "").toLowerCase();
  const url = (item.url ?? "").toLowerCase();
  return (
    url === "/admin" ||
    title.includes("panel de administr") ||
    message.includes("panel de administr") ||
    buttonLabel.includes("panel de administr")
  );
}

const FEE_SECTION_LABELS: Record<string, string> = {
  EXAMENES: "Exámenes",
  TRAMITES: "Trámites",
  DIVERSOS: "Diversos",
};

const BUSINESS_LINE_LABELS: Record<string, string> = {
  salud: "Salud",
  licenciatura: "Licenciatura",
  prepa: "Bachillerato",
  bachillerato: "Bachillerato",
  posgrado: "Posgrado",
};

function formatBusinessLineLabel(value: string | null | undefined) {
  const key = String(value ?? "").trim().toLowerCase();
  if (!key) return "";
  return BUSINESS_LINE_LABELS[key] ?? value ?? "";
}

function useCampuses() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/public/campuses", { cache: "no-store" });
        const data = (await res.json()) as { campuses?: Campus[] };
        if (!mounted) return;
        setCampuses(data.campuses ?? []);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  return { campuses, loading };
}

function digitsOnly(s: string) {
  return s.replace(/\D/g, "");
}

function getDirectoryMethods(contact: DirectoryContact) {
  return contact.methods?.length
    ? contact.methods.map((method) => ({
        value: method.value,
        href:
          method.href ??
          buildDirectoryContactHref({
            type: method.type as
              | "EMAIL"
              | "PHONE"
              | "WHATSAPP"
              | "URL"
              | "OTHER",
            value: method.value,
          }),
      }))
    : parseDirectoryContactMethods(contact.contact ?? contact.email).map((method) => ({
        value: method.value,
        href: buildDirectoryContactHref(method),
      }));
}

function OfertaAcademicaSection() {
  const { campuses } = useCampuses();
  const [campus, setCampus] = useState("");
  const [line, setLine] = useState("");
  const [availableCycles, setAvailableCycles] = useState<AcademicOfferCycle[]>([]);
  const [cycle, setCycle] = useState<AcademicOfferCycle | "">("");
  const [programs, setPrograms] = useState<OfertaProgram[]>([]);
  const [offerings, setOfferings] = useState<OfertaOffering[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (campus) params.set("campus", campus);
      if (line) params.set("line", line);
      if (cycle) params.set("cycle", cycle);
      try {
        const res = await fetch(`/api/public/oferta?${params.toString()}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as {
          availableCycles?: AcademicOfferCycle[];
          programs?: OfertaProgram[];
          offerings?: OfertaOffering[];
        };
        if (!mounted) return;
        const nextAvailable = (data.availableCycles ?? []).filter(Boolean);
        setAvailableCycles(nextAvailable);
        const resolvedCycle =
          cycle && nextAvailable.includes(cycle) ? cycle : nextAvailable[0] ?? "";
        if (resolvedCycle !== cycle) {
          setCycle(resolvedCycle);
        }
        if (!campus || !resolvedCycle) {
          setPrograms([]);
          setOfferings([]);
          setSelectedProgram("");
          setPreviewUrl(null);
          return;
        }
        setPrograms(data.programs ?? []);
        setOfferings(data.offerings ?? []);
        setSelectedProgram((current) =>
          (data.programs ?? []).some((program) => program.programId === current)
            ? current
            : "",
        );
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [campus, cycle, line]);

  const currentProgram = programs.find((p) => p.programId === selectedProgram) ?? null;
  const currentOfferings = useMemo(
    () => offerings.filter((offering) => offering.program.id === selectedProgram),
    [offerings, selectedProgram],
  );

  useEffect(() => {
    if (!currentProgram) {
      setPreviewUrl(null);
      return;
    }

    const nextPreview =
      currentProgram.planPdfUrl ??
      currentOfferings[0]?.planLink ??
      currentProgram.brochurePdfUrl ??
      null;
    setPreviewUrl(nextPreview);
  }, [currentOfferings, currentProgram]);

  const galleryImages = useMemo(() => {
    const images = [
      currentProgram?.thumbnailImageUrl,
      currentProgram?.heroImageUrl,
      ...programs.flatMap((program) => [program.thumbnailImageUrl, program.heroImageUrl]),
    ].filter((url): url is string => Boolean(url));
    return Array.from(new Set(images)).slice(0, 4);
  }, [currentProgram?.heroImageUrl, currentProgram?.thumbnailImageUrl, programs]);

  return (
    <section className="ui-card ui-card-pad min-w-0">
      <h2 className="text-lg font-semibold">Oferta académica</h2>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="grid min-w-0 gap-2 text-sm">
          Ciclo
          <SmartSelect
            value={cycle}
            onChange={(value) => setCycle(value as AcademicOfferCycle)}
            placeholder={
              availableCycles.length ? "Selecciona ciclo" : "Sin ciclos visibles"
            }
            options={availableCycles.map((item) => ({
              value: item,
              label: item,
            }))}
          />
        </div>
        <div className="grid min-w-0 gap-2 text-sm">
          Plantel
          <SmartSelect
            value={campus}
            onChange={setCampus}
            placeholder="Selecciona plantel"
            options={campuses.map((item) => ({
              value: item.metaKey,
              label: item.name,
            }))}
          />
        </div>
        <div className="grid min-w-0 gap-2 text-sm">
          Línea de negocio
          <SmartSelect
            value={line}
            onChange={setLine}
            placeholder="Todas"
            options={[
              { value: "", label: "Todas" },
              { value: "salud", label: "Salud" },
              { value: "licenciatura", label: "Licenciatura" },
              { value: "prepa", label: "Bachillerato" },
              { value: "posgrado", label: "Posgrado" },
            ]}
          />
        </div>
      </div>

      {!availableCycles.length ? (
        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Sin ciclos visibles.
        </div>
      ) : null}

      {campus && cycle && (
        <div className="mt-4 grid min-w-0 gap-2 text-sm">
          Programa
          {loading ? (
            <div className="ui-control text-slate-400">Cargando programas...</div>
          ) : (
            <SmartSelect
              value={selectedProgram}
              onChange={setSelectedProgram}
              placeholder={programs.length ? "Selecciona programa" : "Sin programas disponibles"}
              options={programs.map((p) => ({ value: p.programId, label: p.name }))}
            />
          )}
        </div>
      )}

      {!!availableCycles.length && !campus && (
        <div className="mt-6 text-sm text-slate-400">Sin plantel seleccionado.</div>
      )}

      {currentProgram && (
        <div className="mt-6 grid gap-4">
          <div className="grid gap-[var(--ui-card-gap)] xl:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.22fr)]">
            <div className="grid content-start gap-3 rounded-3xl border border-white/10 bg-slate-950/35 p-[calc(var(--ui-card-pad)*0.9)]">
              {galleryImages.length ? (
                <div className="grid h-40 grid-cols-2 grid-rows-2 gap-2 overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-2">
                  {galleryImages.map((url, index) => (
                    <div
                      key={url}
                      className={index === 0 ? "row-span-2 overflow-hidden rounded-xl" : "overflow-hidden rounded-xl"}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`${currentProgram.name} ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-emerald-300/80">
                  Programa seleccionado
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-100">
                  {currentProgram.name}
                </div>
                {currentProgram.category ? (
                  <div className="mt-1 text-sm text-slate-400">{currentProgram.category}</div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {currentProgram.businessLine ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-300">
                    Línea:{" "}
                    <span className="font-semibold text-slate-100">
                      {formatBusinessLineLabel(currentProgram.businessLine)}
                    </span>
                  </div>
                ) : null}
                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-300">
                  Ofertas visibles:{" "}
                  <span className="font-semibold text-slate-100">
                    {currentOfferings.length}
                  </span>
                </div>
              </div>

              <div className="grid gap-2">
                {currentProgram.planPdfUrl ? (
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={currentProgram.planPdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-slate-100 transition hover:bg-white/10"
                    >
                      Preview plan
                    </a>
                    <a
                      href={currentProgram.planDownloadUrl ?? currentProgram.planPdfUrl}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-slate-100 transition hover:bg-white/10"
                    >
                      Descargar
                    </a>
                  </div>
                ) : null}
                {currentProgram.brochurePdfUrl ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewUrl(currentProgram.brochurePdfUrl)}
                      className="rounded-2xl border border-emerald-500/30 bg-emerald-500/16 px-4 py-3 text-center text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/24"
                    >
                      Preview brochure
                    </button>
                    <a
                      href={currentProgram.brochureDownloadUrl ?? currentProgram.brochurePdfUrl}
                      className="rounded-2xl border border-emerald-500/30 bg-emerald-500/16 px-4 py-3 text-center text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/24"
                    >
                      Descargar
                    </a>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/30 p-[calc(var(--ui-card-pad)*0.9)]">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
                  Oferta por modalidad
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  Aquí ves cómo se oferta el programa en el plantel y ciclo seleccionados.
                </div>
              </div>

              {currentOfferings.length ? (
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <div className="hidden grid-cols-[minmax(120px,1fr)_minmax(180px,1.4fr)_minmax(164px,auto)] gap-3 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-slate-100 md:grid">
                    <div>Modalidad</div>
                    <div>Horario</div>
                    <div className="text-right">Plan</div>
                  </div>
                  <div className="divide-y divide-white/10">
                    {currentOfferings.map((offering) => {
                      const link = offering.planLink ?? currentProgram.planPdfUrl;
                      const downloadLink =
                        offering.planDownloadLink ??
                        currentProgram.planDownloadUrl ??
                        link;
                      return (
                        <div
                          key={offering.id}
                          className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[minmax(120px,1fr)_minmax(180px,1.4fr)_minmax(164px,auto)] md:items-center"
                        >
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 md:hidden">
                              Modalidad
                            </div>
                            <div className="break-words text-slate-100">{offering.modality}</div>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 md:hidden">
                              Horario
                            </div>
                            <div className="break-words text-slate-300">
                              {offering.schedule?.trim() || "Horario no disponible"}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 md:hidden">
                              Plan
                            </div>
                            {link ? (
                              <div className="mt-2 flex flex-wrap gap-2 md:mt-0 md:justify-end">
                                <button
                                  type="button"
                                  onClick={() => setPreviewUrl(link)}
                                  className="ui-button-secondary min-h-[34px] px-3 text-xs"
                                >
                                  Ver PDF
                                </button>
                                <a
                                  href={downloadLink ?? link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="ui-button-info min-h-[34px] px-3 text-xs"
                                >
                                  Descargar
                                </a>
                              </div>
                            ) : (
                              <span className="text-slate-500 md:block md:text-right">Sin PDF</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-slate-400">
                  No hay modalidades u horarios registrados para este programa.
                </div>
              )}
            </div>
          </div>

          {previewUrl ? (
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/30">
              <iframe
                src={previewUrl}
                title={`PDF: ${currentProgram.name}`}
                className="w-full"
                style={{ height: "clamp(360px, 52vh, 760px)", border: "none" }}
              />
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-slate-950/30 p-[calc(var(--ui-card-pad)*1.15)] text-center text-sm text-slate-400">
              PDF de oferta no disponible para este programa.
            </div>
          )}
        </div>
      )}

      {campus && cycle && !loading && programs.length === 0 && (
        <div className="mt-6 text-sm text-slate-300">Sin programas disponibles.</div>
      )}
    </section>
  );
}

function CostosAcademicosSection() {
  const { campuses } = useCampuses();
  const [campus, setCampus] = useState("");
  const [fees, setFees] = useState<AcademicFee[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFee, setSelectedFee] = useState("");

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      setFees([]);
      setSelectedFee("");
      const params = new URLSearchParams();
      if (campus) params.set("campus", campus);
      try {
        const res = await fetch(`/api/public/costos?${params.toString()}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { fees?: AcademicFee[] };
        if (!mounted) return;
        setFees(data.fees ?? []);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [campus]);

  const currentFee = fees.find((f) => f.id === selectedFee) ?? null;

  // Group fees by section for the table view
  const grouped = useMemo(() => {
    const map: Record<string, AcademicFee[]> = {};
    for (const fee of fees) {
      if (!map[fee.section]) map[fee.section] = [];
      map[fee.section].push(fee);
    }
    return map;
  }, [fees]);

  return (
    <section className="ui-card ui-card-pad min-w-0">
      <h2 className="text-lg font-semibold">Costos académicos</h2>

      <div className="mt-4 grid min-w-0 gap-2 text-sm md:max-w-lg">
        Plantel
        <SmartSelect
          value={campus}
          onChange={setCampus}
          placeholder="Todos"
          options={[
            { value: "", label: "Todos" },
            ...campuses.map((item) => ({
              value: item.metaKey,
              label: item.name,
            })),
          ]}
        />
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-slate-300">Cargando costos...</div>
      ) : fees.length > 0 ? (
        <div className="mt-6 grid gap-6">
          {/* Quick selector */}
          <div className="grid min-w-0 gap-2 text-sm xl:max-w-2xl">
            Buscar trámite / concepto
            <SmartSelect
              value={selectedFee}
              onChange={setSelectedFee}
              placeholder="Selecciona un concepto"
              options={fees.map((f) => ({ value: f.id, label: f.concept }))}
            />
          </div>

          {/* Detail card for selected fee */}
          {currentFee && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4">
              <div className="font-semibold text-slate-100">{currentFee.concept}</div>
              <div className="mt-1 flex items-center gap-3">
                <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-xs text-slate-300">
                  {FEE_SECTION_LABELS[currentFee.section]}
                </span>
                <span className="text-lg font-bold text-emerald-300">
                  ${currentFee.costMxn.toLocaleString("es-MX")} MXN
                </span>
              </div>
            </div>
          )}

          {/* Grouped table */}
          <div className="grid gap-4">
            {Object.entries(grouped).map(([section, sectionFees]) => (
              <div key={section}>
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                  {FEE_SECTION_LABELS[section] ?? section}
                </div>
                <div className="ui-table-wrap ui-scrollbar">
                  <table className="ui-table min-w-[400px]">
                    <thead>
                      <tr>
                        <th className="text-left font-semibold">Concepto</th>
                        <th className="ui-cell-nowrap text-right font-semibold">Costo MXN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionFees.map((fee) => (
                        <tr key={fee.id}>
                          <td className="text-slate-100">{fee.concept}</td>
                          <td className="ui-cell-nowrap text-right text-slate-200">
                            ${fee.costMxn.toLocaleString("es-MX")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : campus ? (
        <div className="mt-4 text-sm text-slate-300">
          No hay costos registrados para este plantel.
        </div>
      ) : (
        <div className="mt-4 text-sm text-slate-300">Sin plantel seleccionado.</div>
      )}
    </section>
  );
}

function PlanesSection() {
  const [line, setLine] = useState("licenciatura");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<PlanProgram[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (line) params.set("line", line);
      if (query.trim()) params.set("q", query.trim());
      try {
        const res = await fetch(`/api/public/planes?${params.toString()}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { programs?: PlanProgram[] };
        if (!mounted) return;
        setRows(data.programs ?? []);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [line, query]);

  return (
    <section className="ui-card ui-card-pad min-w-0">
      <h2 className="text-lg font-semibold">Planes de estudio</h2>

      <div className="mt-4 ui-form-grid ui-form-grid--two">
        <div className="grid min-w-0 gap-2 text-sm">
          Línea de negocio
          <SmartSelect
            value={line}
            onChange={setLine}
            placeholder="Selecciona línea"
            options={[
              { value: "", label: "Todas las líneas" },
              { value: "salud", label: "Salud" },
              { value: "licenciatura", label: "Licenciatura" },
              { value: "prepa", label: "Bachillerato" },
              { value: "posgrado", label: "Posgrado" },
            ]}
          />
        </div>
        <div className="grid min-w-0 gap-2 text-sm">
          Buscar programa
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="ui-control"
            placeholder="Nombre del programa"
          />
        </div>
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-slate-300">Cargando programas...</div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {rows.map((row) => (
            <div
              key={row.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30"
            >
              {row.planPdfUrl ? (
                <div className="h-40 overflow-hidden border-b border-white/10 bg-white">
                  <iframe
                    src={row.planPdfUrl}
                    title={`Preview plan: ${row.name}`}
                    className="h-full w-full"
                  />
                </div>
              ) : (row.thumbnailImageUrl ?? row.heroImageUrl) ? (
                <div className="h-40 border-b border-white/10 bg-black/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={row.thumbnailImageUrl ?? row.heroImageUrl ?? ""}
                    alt={row.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}
              <div className="p-4">
                <div className="font-semibold text-slate-100">{row.name}</div>
                {row.category && (
                  <div className="mt-0.5 text-xs text-slate-400">{row.category}</div>
                )}
                <div className="mt-3">
                  <span
                    className={
                      row.hasPlan
                        ? "rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200"
                        : "rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-500"
                    }
                  >
                    {row.hasPlan ? "Plan disponible" : "Plan no disponible"}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {row.planPdfUrl ? (
                    <a
                      href={row.planPdfUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ui-button-secondary min-h-[32px] rounded-full px-3 py-1 text-xs"
                    >
                      Abrir preview
                    </a>
                  ) : null}
                  {row.planDownloadUrl ? (
                    <a
                      href={row.planDownloadUrl}
                      className="ui-button-info min-h-[32px] rounded-full px-3 py-1 text-xs"
                    >
                      Descargar
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {!rows.length ? (
            <div className="col-span-full text-sm text-slate-300">Sin resultados.</div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function formatFileSize(value: number | null) {
  if (!value) return null;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdfPreview(fileUrl: string | null | undefined, mimeType?: string | null) {
  return mimeType === "application/pdf" || String(fileUrl ?? "").toLowerCase().includes(".pdf");
}

function FormatosSection() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<EnrollmentFormat[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      try {
        const res = await fetch(`/api/public/formatos?${params.toString()}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { formats?: EnrollmentFormat[] };
        if (!mounted) return;
        setRows(data.formats ?? []);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [query]);

  return (
    <section className="ui-card ui-card-pad min-w-0">
      <h2 className="text-lg font-semibold">Formatos</h2>

      <div className="mt-4 grid min-w-0 gap-2 text-sm">
        Buscar formato
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="ui-control"
          placeholder="Inscripción, documentos, solicitud..."
        />
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-slate-300">Cargando formatos...</div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const fileSize = formatFileSize(row.fileSizeBytes);
            const showPdfPreview = isPdfPreview(row.fileUrl, row.fileMimeType);
            return (
              <div
                key={row.id}
                className="grid min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30"
              >
                {showPdfPreview ? (
                  <div className="h-44 border-b border-white/10 bg-white">
                    <iframe
                      src={row.fileUrl}
                      title={`Preview formato: ${row.title}`}
                      className="h-full w-full"
                    />
                  </div>
                ) : null}
                <div className="grid min-w-0 gap-3 p-4">
                  <div className="break-words font-semibold text-slate-100">
                    {row.title}
                  </div>
                  {row.description ? (
                    <div className="mt-1 break-words text-sm leading-5 text-slate-300">
                      {row.description}
                    </div>
                  ) : null}
                  <div className="mt-2 text-xs text-slate-500">
                    {[row.fileName, fileSize].filter(Boolean).join(" · ") ||
                      "Link de descarga"}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={row.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ui-button-secondary min-h-[32px] rounded-full px-3 py-1 text-xs"
                    >
                      Abrir preview
                    </a>
                    <a
                      href={row.fileUrl}
                      className="ui-button-info min-h-[32px] rounded-full px-3 py-1 text-xs"
                    >
                      Descargar
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
          {!rows.length ? (
            <div className="col-span-full text-sm text-slate-300">Sin formatos disponibles.</div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function DirectorioSection() {
  const { campuses } = useCampuses();
  const [campus, setCampus] = useState("");
  const [area, setArea] = useState("");
  const [rows, setRows] = useState<DirectoryContact[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (campus) params.set("campus", campus);
      if (area) params.set("zone", area);
      try {
        const res = await fetch(`/api/public/directorio?${params.toString()}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { contacts?: DirectoryContact[] };
        if (!mounted) return;
        setRows(data.contacts ?? []);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [campus, area]);

  // Group contacts by área (zone field)
  const grouped = useMemo(() => {
    const map = new Map<string, DirectoryContact[]>();
    // Pre-fill ordered areas
    for (const a of DIRECTORY_AREAS) map.set(a, []);
    for (const r of rows) {
      const key = r.zone ?? "Otros";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    // Remove empty groups
    for (const [k, v] of map) {
      if (!v.length) map.delete(k);
    }
    return map;
  }, [rows]);

  return (
    <section className="ui-card ui-card-pad min-w-0">
      <h2 className="text-lg font-semibold">Directorio</h2>

      <div className="mt-4 ui-form-grid ui-form-grid--two">
        <div className="grid min-w-0 gap-2 text-sm">
          Plantel
          <SmartSelect
            value={campus}
            onChange={setCampus}
            placeholder="Todos los planteles"
            options={[
              { value: "", label: "Todos" },
              ...campuses.map((item) => ({
                value: item.metaKey,
                label: item.name,
              })),
            ]}
          />
        </div>
        <div className="grid min-w-0 gap-2 text-sm">
          Área
          <SmartSelect
            value={area}
            onChange={setArea}
            placeholder="Todas las áreas"
            options={[
              { value: "", label: "Todas" },
              ...DIRECTORY_AREAS.map((a) => ({ value: a, label: a })),
            ]}
          />
        </div>
      </div>

      {loading ? (
        <div className="mt-6 text-sm text-slate-300">Cargando directorio...</div>
      ) : grouped.size === 0 ? (
        <div className="mt-6 text-sm text-slate-400">Sin resultados para los filtros seleccionados.</div>
      ) : (
        <div className="mt-6 grid gap-6">
          {Array.from(grouped.entries()).map(([areaName, contacts]) => (
            <div key={areaName}>
              {/* Área header */}
              <div className="mb-3 flex items-center gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-400/90">
                  {areaName}
                </div>
                <div className="h-px flex-1 bg-emerald-500/15" />
                <div className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300/70">
                  {contacts.length}
                </div>
              </div>

              {/* Cards grid */}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {contacts.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-white/8 bg-slate-950/30 p-4 transition hover:border-white/15 hover:bg-slate-950/50"
                  >
                    <div className="font-semibold text-slate-100 leading-tight">
                      {row.name || "—"}
                    </div>
                    {row.role && (
                      <div className="mt-0.5 text-xs text-emerald-300/80">{row.role}</div>
                    )}
                    <div className="mt-2 text-xs text-slate-400">{row.campus.name}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {getDirectoryMethods(row).length > 0 ? (
                        getDirectoryMethods(row).map(({ value, href }) => {
                          if (!href) {
                            return (
                              <span
                                key={value}
                                className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300"
                              >
                                {value}
                              </span>
                            );
                          }

                          return (
                            <a
                              key={value}
                              href={href}
                              target={href.startsWith("http") ? "_blank" : undefined}
                              rel={href.startsWith("http") ? "noreferrer" : undefined}
                              className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300 transition hover:border-emerald-400/40 hover:text-emerald-300"
                            >
                              {value}
                            </a>
                          );
                        })
                      ) : (
                        <span className="text-xs text-slate-500">Contacto no disponible</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PlantelesSection() {
  const { campuses, loading } = useCampuses();

  return (
    <section className="ui-card ui-card-pad min-w-0">
      <h2 className="text-lg font-semibold">Planteles</h2>

      {loading ? (
        <div className="mt-4 text-sm text-slate-300">Cargando planteles...</div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {campuses.map((campus) => (
            <div
              key={campus.id}
              className="rounded-2xl border border-white/10 bg-slate-950/30 p-4"
            >
              <div className="font-semibold text-slate-100">{campus.name}</div>
              <div className="mt-1 text-xs text-slate-400">
                {campus.kind === "online" ? "Online" : "Presencial"} · {campus.code}
              </div>

              {campus.address ? (
                <div className="mt-2 text-xs text-slate-300">{campus.address}</div>
              ) : (
                <div className="mt-2 text-xs text-slate-500">Dirección: n/a</div>
              )}

              <div className="mt-2 flex flex-wrap gap-2">
                {campus.phone ? (
                  <a
                    href={`tel:${campus.phone}`}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-300 transition hover:bg-white/10"
                  >
                    Tel: {campus.phone}
                  </a>
                ) : (
                  <span className="text-xs text-slate-500">Tel: n/a</span>
                )}

                {campus.whatsapp ? (
                  <a
                    href={`https://wa.me/${digitsOnly(campus.whatsapp)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-[#0f7a68] bg-[#128c7e] px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0f7a68]"
                  >
                    WhatsApp
                  </a>
                ) : (
                  <span className="text-xs text-slate-500">WhatsApp: n/a</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function UnidepWorkspace({
  ctasBelowResult = [],
  ctasAboveResult = [],
  ctasInsideResult = [],
  resultBelowAnnouncements = [],
  resultAboveAnnouncements = [],
  resultInsideAnnouncements = [],
  authWelcomeAnnouncements = [],
  authWelcomeInsideAnnouncements = [],
  unidepPrimaryAnnouncements = [],
  calculatorFooterAnnouncements = [],
  ctasCalculatorFooter = [],
  ctasSimulatorTop = [],
  ctasSimulatorBottom = [],
  simulatorTopAnnouncements = [],
  simulatorBottomAnnouncements = [],
  whatsappTemplates,
  newUser = false,
  quoteMode = "canonical",
  visibleOfferCycles = ["C1"],
  forcedSection,
}: {
  ctasBelowResult?: PublicCta[];
  ctasAboveResult?: PublicCta[];
  ctasInsideResult?: PublicCta[];
  resultBelowAnnouncements?: Announcement[];
  resultAboveAnnouncements?: Announcement[];
  resultInsideAnnouncements?: Announcement[];
  authWelcomeAnnouncements?: Announcement[];
  authWelcomeInsideAnnouncements?: Announcement[];
  unidepPrimaryAnnouncements?: Announcement[];
  calculatorFooterAnnouncements?: Announcement[];
  ctasCalculatorFooter?: PublicCta[];
  ctasSimulatorTop?: PublicCta[];
  ctasSimulatorBottom?: PublicCta[];
  simulatorTopAnnouncements?: Announcement[];
  simulatorBottomAnnouncements?: Announcement[];
  whatsappTemplates: WhatsappTemplateCollection;
  newUser?: boolean;
  quoteMode?: "canonical";
  visibleOfferCycles?: AcademicOfferCycle[];
  forcedSection?: WorkspaceSectionKey;
}) {
  const { activeSection, setActiveSection, userEmail } = useAppContext();
  const sectionToRender = forcedSection ?? (activeSection as WorkspaceSectionKey);
  const workspacePrimaryAnnouncements = unidepPrimaryAnnouncements.filter(
    (item) => !isAdminPanelAnnouncement(item),
  );
  const authWelcomePrimaryAnnouncements = authWelcomeAnnouncements.filter(
    (item) => !isAdminPanelAnnouncement(item),
  );
  const authWelcomeInsidePrimaryAnnouncements = authWelcomeInsideAnnouncements.filter(
    (item) => !isAdminPanelAnnouncement(item),
  );

  if (sectionToRender === "oferta") return <OfertaAcademicaSection />;
  if (sectionToRender === "formatos") return <FormatosSection />;
  if (sectionToRender === "costos") return <CostosAcademicosSection />;
  if (sectionToRender === "planes") return <PlanesSection />;
  if (sectionToRender === "directorio") return <DirectorioSection />;
  if (sectionToRender === "planteles") return <PlantelesSection />;
  if (sectionToRender === "contactos") {
    return <ContactsPanel />;
  }
  if (sectionToRender === "agenda") {
    return <AgendaPanel collapsible={false} defaultOpen />;
  }
  if (sectionToRender === "web") {
    return <WebCampaignsPanel />;
  }
  if (sectionToRender === "waba") {
    return canAccessWorkspaceWhatsapp(userEmail) ? (
      <WabaEmbeddedSignupSection surface="workspace" />
    ) : (
      <WebCampaignsPanel />
    );
  }

  if (sectionToRender === "historial") {
    return (
      <div className="grid gap-[var(--ui-shell-gap)]">
        <SimulatorSidebarPanel
          activeSection={sectionToRender}
          onSelectSection={setActiveSection}
          topCtas={ctasSimulatorTop}
          bottomCtas={ctasSimulatorBottom}
          topAnnouncements={simulatorTopAnnouncements}
          bottomAnnouncements={simulatorBottomAnnouncements}
          collapsible={false}
          defaultOpen
        />
      </div>
    );
  }

  return (
    <div className="grid gap-[var(--ui-shell-gap)]">
      {newUser ? (
        <div className="ui-note ui-note--info">
          Acceso nuevo detectado. Revisa tus datos de sesión y completa tu configuración inicial.
        </div>
      ) : null}
      {workspacePrimaryAnnouncements.length ? (
        <AnnouncementOutlet
          announcements={workspacePrimaryAnnouncements}
          className="grid gap-2"
        />
      ) : null}
      {authWelcomePrimaryAnnouncements.length ? (
        <AnnouncementOutlet
          announcements={authWelcomePrimaryAnnouncements}
          className="grid gap-2"
        />
      ) : null}
      {authWelcomeInsidePrimaryAnnouncements.length ? (
        <AnnouncementOutlet
          announcements={authWelcomeInsidePrimaryAnnouncements}
          className="grid gap-2"
        />
      ) : null}

      <ScholarshipCalculator
        ctasAboveResult={ctasAboveResult}
        ctasInsideResult={ctasInsideResult}
        ctasBelowResult={ctasBelowResult}
        resultBelowAnnouncements={resultBelowAnnouncements}
        resultAboveAnnouncements={resultAboveAnnouncements}
        resultInsideAnnouncements={resultInsideAnnouncements}
        calculatorFooterAnnouncements={calculatorFooterAnnouncements}
        ctasCalculatorFooter={ctasCalculatorFooter}
        whatsappTemplates={whatsappTemplates}
        hideActionRail
        quoteMode={quoteMode}
        visibleOfferCycles={visibleOfferCycles}
      />
    </div>
  );
}
