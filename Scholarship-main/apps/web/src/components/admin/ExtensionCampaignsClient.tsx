"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

type CampaignRecipient = {
  id: string;
  contactValue: string;
  contactName: string | null;
  status: string;
  resolvedMessage: string;
  scheduledFor?: string | null;
  attemptedAt?: string | null;
  sentAt?: string | null;
  lastError?: string | null;
};

type CampaignRecord = {
  id: string;
  campaignName: string;
  status: string;
  scheduleAt: string | null;
  batchSize: number;
  messageTemplate: string | null;
  messageDelayMs: number;
  mediaUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  stats: {
    total: number;
    queued?: number;
    scheduled?: number;
    claimed?: number;
    sent?: number;
    failed?: number;
  };
  recipients: CampaignRecipient[];
};

type UploadedAsset = {
  secureUrl: string;
  publicId: string;
  bytes: number | null;
  format: string | null;
  resourceType: string | null;
};

const DEFAULT_TEMPLATE = [
  "Hola {{nombre}}, te comparto la información que acordamos.",
  "",
  "Si gustas, te ayudo a seguir con el proceso.",
].join("\n");

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-MX");
}

function formatSchedule(value: string | null) {
  if (!value) return "Inmediata";
  return formatDateTime(value);
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        current += '"';
        index += 1;
        continue;
      }
      quoted = !quoted;
      continue;
    }

    if (!quoted && char === ",") {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function mergeRecipientsText(currentText: string, importedText: string) {
  return [currentText.trim(), importedText.trim()].filter(Boolean).join("\n");
}

function csvToRecipientsText(csvText: string) {
  const lines = csvText
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return "";

  const rows = lines.map(parseCsvLine);
  const header = rows[0]?.map((value) => value.trim().toLowerCase()) ?? [];
  const looksLikeHeader = header.some((value) =>
    ["nombre", "name", "numero", "número", "number", "telefono", "teléfono", "phone"].includes(
      value,
    ),
  );

  const dataRows = looksLikeHeader ? rows.slice(1) : rows;

  return dataRows
    .map((columns) => columns.map((value) => value.trim()).filter(Boolean))
    .filter((columns) => columns.length > 0)
    .map((columns) => {
      if (columns.length === 1) return columns[0];
      return `${columns[0]}, ${columns[columns.length - 1]}`;
    })
    .join("\n");
}

function statusTone(status: string) {
  switch (status) {
    case "completed":
    case "sent":
      return "border-emerald-400/25 bg-blue-950/20 text-emerald-100";
    case "partial":
      return "border-cyan-400/25 bg-cyan-500/10 text-cyan-100";
    case "failed":
      return "border-red-400/25 bg-red-500/10 text-red-100";
    case "running":
    case "processing":
    case "claimed":
      return "border-sky-400/25 bg-sky-500/10 text-sky-100";
    case "scheduled":
    case "waiting_runner":
      return "border-amber-400/25 bg-amber-500/10 text-amber-100";
    default:
      return "border-white/10 bg-slate-900/60 text-slate-200";
  }
}

export default function ExtensionCampaignsClient() {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [notes, setNotes] = useState("");
  const [recipientsText, setRecipientsText] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [batchSize, setBatchSize] = useState("25");
  const [delaySeconds, setDelaySeconds] = useState("4");
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_TEMPLATE);
  const [uploadedAsset, setUploadedAsset] = useState<UploadedAsset | null>(null);
  const [manualMediaUrl, setManualMediaUrl] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  async function loadCampaigns({ silent = false }: { silent?: boolean } = {}) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/ext/campaigns", {
        cache: "no-store",
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        campaigns?: CampaignRecord[];
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No fue posible cargar las campañas.");
      }

      const nextCampaigns = data.campaigns ?? [];
      setCampaigns(nextCampaigns);
      setSelectedCampaignId((current) => {
        if (current && nextCampaigns.some((campaign) => campaign.id === current)) {
          return current;
        }
        return nextCampaigns[0]?.id ?? null;
      });
      setError(null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "No fue posible cargar las campañas.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadCampaigns();
    const interval = window.setInterval(() => {
      void loadCampaigns({ silent: true });
    }, 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const parsedRecipients = useMemo(() => {
    return recipientsText
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }, [recipientsText]);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? campaigns[0] ?? null,
    [campaigns, selectedCampaignId],
  );

  const totals = useMemo(() => {
    return campaigns.reduce(
      (acc, campaign) => {
        acc.campaigns += 1;
        acc.contacts += campaign.stats.total;
        acc.sent += campaign.stats.sent ?? 0;
        acc.failed += campaign.stats.failed ?? 0;
        acc.running += ["running", "processing", "waiting_runner"].includes(campaign.status)
          ? 1
          : 0;
        return acc;
      },
      { campaigns: 0, contacts: 0, sent: 0, failed: 0, running: 0 },
    );
  }, [campaigns]);

  async function handleCsvImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = csvToRecipientsText(text);
      if (!imported.trim()) {
        throw new Error("El CSV no trajo filas válidas con nombre y/o número.");
      }
      setRecipientsText((current) => mergeRecipientsText(current, imported));
      setSuccess(`CSV importado: ${file.name}`);
      setError(null);
    } catch (csvError) {
      setError(csvError instanceof Error ? csvError.message : "No fue posible leer el CSV.");
      setSuccess(null);
    } finally {
      event.target.value = "";
    }
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch("/api/ext/campaigns/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        asset?: UploadedAsset;
      };

      if (!response.ok || !data.ok || !data.asset) {
        throw new Error(data.error || "No fue posible subir la imagen.");
      }

      setUploadedAsset(data.asset);
      setManualMediaUrl(data.asset.secureUrl);
      setSuccess(`Imagen cargada: ${file.name}`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No fue posible subir la imagen.");
      setUploadedAsset(null);
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/ext/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          campaignName,
          notes,
          recipientsText,
          scheduleAt: scheduleAt || null,
          batchSize: Number(batchSize) || 25,
          messageTemplate,
          messageDelayMs: Math.max(0.25, Number(delaySeconds) || 4) * 1000,
          mediaUrl: manualMediaUrl || null,
          meta: {
            source: "admin_extension_panel",
            mediaPublicId: uploadedAsset?.publicId ?? null,
            mediaBytes: uploadedAsset?.bytes ?? null,
          },
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        campaign?: CampaignRecord;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No fue posible crear la campaña.");
      }

      setSuccess("Campaña creada y lista para que la extensión reclame batches y reporte resultados.");
      setCampaignName("");
      setNotes("");
      setRecipientsText("");
      setScheduleAt("");
      setBatchSize("25");
      setDelaySeconds("4");
      setMessageTemplate(DEFAULT_TEMPLATE);
      setUploadedAsset(null);
      setManualMediaUrl("");
      await loadCampaigns();
      if (data.campaign?.id) setSelectedCampaignId(data.campaign.id);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No fue posible crear la campaña.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="ui-card ui-card-pad grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">
            Campañas automáticas
          </div>
          <h2 className="mt-1 text-lg font-semibold text-slate-100">
            Campañas para la extensión
          </h2>
        </div>
        <div className="grid min-w-[220px] gap-2 rounded-3xl border border-white/10 bg-slate-950/40 p-3 text-xs text-slate-300 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-2.5">
            <div className="uppercase tracking-[0.2em] text-slate-400">Campañas</div>
            <div className="mt-1 text-lg font-semibold text-white">{totals.campaigns}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-2.5">
            <div className="uppercase tracking-[0.2em] text-slate-400">Contactos</div>
            <div className="mt-1 text-lg font-semibold text-white">{totals.contacts}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-2.5">
            <div className="uppercase tracking-[0.2em] text-slate-400">Enviados</div>
            <div className="mt-1 text-lg font-semibold text-white">{totals.sent}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-2.5">
            <div className="uppercase tracking-[0.2em] text-slate-400">Fallidos</div>
            <div className="mt-1 text-lg font-semibold text-white">{totals.failed}</div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-500/35 bg-blue-950/20 px-3 py-2 text-sm text-emerald-100">
          {success}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-4 2xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm text-slate-200">
            Nombre de la campaña
            <input
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
              className="ui-control"
              placeholder="Ej. Becas marzo zona norte"
            />
          </label>

          <div className="grid gap-3 rounded-3xl border border-white/10 bg-slate-950/35 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-medium text-slate-100">Contactos</div>
              <label className="rounded-full border border-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-200 transition hover:bg-white/5">
                Importar CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => void handleCsvImport(event)}
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm text-slate-200">
              Lista manual
              <textarea
                value={recipientsText}
                onChange={(event) => setRecipientsText(event.target.value)}
                className="ui-control min-h-[240px] font-mono text-sm"
                placeholder={["Ana Gómez, 5215512345678", "Bruno Ruiz, 525512345679", "525512345680"].join("\n")}
                spellCheck={false}
              />
              <span className="text-xs text-slate-400">
                Si importas CSV, sus filas se agregan aquí para revisarlas antes de crear la campaña.
              </span>
            </label>
          </div>

          <label className="grid gap-2 text-sm text-slate-200">
            Template del mensaje
            <textarea
              value={messageTemplate}
              onChange={(event) => setMessageTemplate(event.target.value)}
              className="ui-control min-h-[180px]"
              spellCheck={false}
            />
            <span className="text-xs text-slate-400">
              Variables disponibles: <code>{"{{nombre}}"}</code> y <code>{"{{numero}}"}</code>.
            </span>
          </label>

          <label className="grid gap-2 text-sm text-slate-200">
            Notas internas
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="ui-control min-h-[96px]"
              placeholder="Objetivo, segmento, horario operativo o criterio comercial."
            />
          </label>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-4 rounded-3xl border border-white/10 bg-slate-950/35 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-200">
                Batch por reclamo
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={batchSize}
                  onChange={(event) => setBatchSize(event.target.value)}
                  className="ui-control"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-200">
                Delay por mensaje (seg)
                <input
                  type="number"
                  min={0.25}
                  max={60}
                  step={0.25}
                  value={delaySeconds}
                  onChange={(event) => setDelaySeconds(event.target.value)}
                  className="ui-control"
                />
              </label>
            </div>

            <label className="grid gap-2 text-sm text-slate-200">
              Programar para
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(event) => setScheduleAt(event.target.value)}
                className="ui-control"
              />
            </label>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-100">Imagen de campaña</div>
                <label className="rounded-full border border-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-200 transition hover:bg-white/5">
                  {uploadingImage ? "Subiendo..." : "Subir imagen"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void handleImageUpload(event)}
                    disabled={uploadingImage}
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm text-slate-200">
                URL interna resuelta
                <input
                  type="url"
                  value={manualMediaUrl}
                  onChange={(event) => setManualMediaUrl(event.target.value)}
                  className="ui-control"
                  placeholder="Se llena al subir la imagen."
                />
              </label>

              {uploadedAsset ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-blue-950/20 px-3 py-2 text-xs text-emerald-100">
                  Cloudinary: {uploadedAsset.publicId}
                </div>
              ) : null}

              {manualMediaUrl ? (
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 p-2">
                  <Image
                    src={manualMediaUrl}
                    alt="Preview de campaña"
                    width={960}
                    height={352}
                    unoptimized
                    className="h-44 w-full rounded-2xl object-cover"
                  />
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-300 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Vista rápida</div>
                <div className="mt-2 space-y-1">
                  <div>{parsedRecipients.length} contacto(s) listos</div>
                  <div>Delay efectivo: {Math.max(0.25, Number(delaySeconds) || 4)} s</div>
                  <div>Adjunto: {manualMediaUrl ? "Sí" : "No"}</div>
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Automatización</div>
                <div className="mt-2 space-y-1">
                  <div>Programación: {scheduleAt ? formatDateTime(new Date(scheduleAt).toISOString()) : "Inmediata"}</div>
                  <div>Batch: {Number(batchSize) || 25}</div>
                  <div>Runner: reclamado por la extensión</div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-blue-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-900 disabled:opacity-60"
            >
              {saving ? "Creando campaña..." : "Crear campaña"}
            </button>
          </div>
        </div>
      </form>

      <section className="grid gap-4 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)]">
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
              Campañas recientes
            </h3>
            <button
              type="button"
              onClick={() => void loadCampaigns()}
              className="rounded-full border border-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-slate-200 transition hover:bg-white/5"
            >
              Recargar
            </button>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-300">
              Cargando campañas...
            </div>
          ) : campaigns.length ? (
            campaigns.map((campaign) => (
              <button
                key={campaign.id}
                type="button"
                onClick={() => setSelectedCampaignId(campaign.id)}
                className={`grid gap-3 rounded-3xl border p-4 text-left transition hover:-translate-y-[1px] ${
                  selectedCampaign?.id === campaign.id
                    ? "border-emerald-400/35 bg-blue-950/20"
                    : "border-white/10 bg-slate-950/35 hover:bg-slate-900/60"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-white">{campaign.campaignName}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {campaign.stats.total} destinatarios · batch {campaign.batchSize}
                    </div>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${statusTone(campaign.status)}`}>
                    {campaign.status}
                  </span>
                </div>
                <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                  <div>Programación: {formatSchedule(campaign.scheduleAt)}</div>
                  <div>Delay: {Math.round(campaign.messageDelayMs / 10) / 100}s</div>
                  <div>Enviados: {campaign.stats.sent ?? 0}</div>
                  <div>Fallidos: {campaign.stats.failed ?? 0}</div>
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/25 p-4 text-sm text-slate-300">
              Aún no hay campañas creadas para la extensión.
            </div>
          )}
        </div>

        <div className="grid gap-4">
          {selectedCampaign ? (
            <>
              <article className="grid gap-4 rounded-3xl border border-white/10 bg-slate-950/35 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Detalle activo</div>
                    <h3 className="mt-1 text-xl font-semibold text-white">{selectedCampaign.campaignName}</h3>
                    <p className="mt-2 text-sm text-slate-300">
                      Creada {formatDateTime(selectedCampaign.createdAt)} · actualizada {formatDateTime(selectedCampaign.updatedAt)}
                    </p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusTone(selectedCampaign.status)}`}>
                    {selectedCampaign.status}
                  </span>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3">
                    <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Template guardado</div>
                    <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-100">
                      {selectedCampaign.messageTemplate || "Sin template guardado."}
                    </pre>
                  </div>

                  <div className="grid gap-3">
                    <div className="grid gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-200 sm:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Programación</div>
                        <div className="mt-1">{formatSchedule(selectedCampaign.scheduleAt)}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Cierre</div>
                        <div className="mt-1">{formatDateTime(selectedCampaign.completedAt)}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Batch</div>
                        <div className="mt-1">{selectedCampaign.batchSize}</div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Delay</div>
                        <div className="mt-1">{Math.round(selectedCampaign.messageDelayMs / 10) / 100}s</div>
                      </div>
                    </div>

                    <div className="grid gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-200 sm:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 px-3 py-2">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">En cola</div>
                        <div className="mt-1 text-lg font-semibold text-white">{selectedCampaign.stats.queued ?? 0}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 px-3 py-2">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Programados</div>
                        <div className="mt-1 text-lg font-semibold text-white">{selectedCampaign.stats.scheduled ?? 0}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 px-3 py-2">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Reclamados</div>
                        <div className="mt-1 text-lg font-semibold text-white">{selectedCampaign.stats.claimed ?? 0}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 px-3 py-2">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Enviados</div>
                        <div className="mt-1 text-lg font-semibold text-white">{selectedCampaign.stats.sent ?? 0}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 px-3 py-2">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Fallidos</div>
                        <div className="mt-1 text-lg font-semibold text-white">{selectedCampaign.stats.failed ?? 0}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 px-3 py-2">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Total</div>
                        <div className="mt-1 text-lg font-semibold text-white">{selectedCampaign.stats.total}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedCampaign.mediaUrl ? (
                  <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/55 p-2">
                    <Image
                      src={selectedCampaign.mediaUrl}
                      alt="Imagen de campaña"
                      width={1280}
                      height={720}
                      unoptimized
                      className="max-h-72 w-full rounded-[20px] object-cover"
                    />
                  </div>
                ) : null}

                {selectedCampaign.notes ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-sm text-slate-300">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Notas</div>
                    <p className="mt-2 whitespace-pre-wrap">{selectedCampaign.notes}</p>
                  </div>
                ) : null}
              </article>

              <article className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Reporte operativo</div>
                    <h3 className="mt-1 text-lg font-semibold text-white">Destinatarios</h3>
                  </div>
                  <div className="text-xs text-slate-400">
                    {selectedCampaign.recipients.length} registro(s)
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:hidden">
                  {selectedCampaign.recipients.slice(0, 60).map((recipient) => (
                    <article
                      key={recipient.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/45 p-3 text-sm text-slate-200"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-white">{recipient.contactName || "Sin nombre"}</div>
                          <div className="mt-1 break-all text-xs text-slate-400">{recipient.contactValue}</div>
                        </div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusTone(recipient.status)}`}>
                          {recipient.status}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-2 text-xs text-slate-400">
                        <div>
                          <div className="uppercase tracking-[0.18em] text-slate-500">Programado</div>
                          <div className="mt-1 text-slate-300">{formatDateTime(recipient.scheduledFor)}</div>
                        </div>
                        <div>
                          <div className="uppercase tracking-[0.18em] text-slate-500">Enviado</div>
                          <div className="mt-1 text-slate-300">{formatDateTime(recipient.sentAt || recipient.attemptedAt)}</div>
                        </div>
                        <div>
                          <div className="uppercase tracking-[0.18em] text-slate-500">Error</div>
                          <div className="mt-1 break-words text-red-200">{recipient.lastError || "—"}</div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="mt-4 hidden overflow-x-auto md:block">
                  <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200">
                    <thead className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Contacto</th>
                        <th className="px-3 py-2">Estatus</th>
                        <th className="px-3 py-2">Programado</th>
                        <th className="px-3 py-2">Enviado</th>
                        <th className="px-3 py-2">Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/6">
                      {selectedCampaign.recipients.slice(0, 60).map((recipient) => (
                        <tr key={recipient.id} className="align-top">
                          <td className="px-3 py-2">
                            <div className="font-medium text-white">{recipient.contactName || "Sin nombre"}</div>
                            <div className="text-xs text-slate-400">{recipient.contactValue}</div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusTone(recipient.status)}`}>
                              {recipient.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-400">{formatDateTime(recipient.scheduledFor)}</td>
                          <td className="px-3 py-2 text-xs text-slate-400">{formatDateTime(recipient.sentAt || recipient.attemptedAt)}</td>
                          <td className="px-3 py-2 text-xs text-red-200">{recipient.lastError || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </>
          ) : (
            <div className="rounded-3xl border border-dashed border-white/15 bg-slate-950/25 p-6 text-sm text-slate-300">
              Selecciona una campaña para ver el template, la imagen y el reporte operativo.
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
