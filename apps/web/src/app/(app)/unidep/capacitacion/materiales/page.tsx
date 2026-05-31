import {
  buildFileAssetLinks,
  listFileAssetUsagesByTargetType,
  type FileAssetUsageRecord,
} from "@/lib/file-assets";

export const dynamic = "force-dynamic";

function formatFileSize(value: number | null) {
  if (!value) return null;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function materialKind(usage: FileAssetUsageRecord) {
  if (usage.file.mimeType.startsWith("video/")) return "Video";
  if (usage.file.mimeType === "application/pdf") return "PDF";
  if (usage.file.mimeType.startsWith("image/")) return "Imagen";
  return "Archivo";
}

function MaterialPreview({ usage }: { usage: FileAssetUsageRecord }) {
  const links = buildFileAssetLinks(usage.file.id);
  if (usage.file.mimeType.startsWith("image/")) {
    return (
      <div className="h-44 overflow-hidden border-b border-white/10 bg-black/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={links.previewUrl} alt={usage.file.fileName} className="h-full w-full object-cover" />
      </div>
    );
  }
  if (usage.file.mimeType.startsWith("video/")) {
    return (
      <div className="h-44 border-b border-white/10 bg-black">
        <video src={links.previewUrl} className="h-full w-full" controls preload="metadata" />
      </div>
    );
  }
  if (usage.file.mimeType === "application/pdf") {
    return (
      <div className="h-44 border-b border-white/10 bg-white">
        <iframe src={links.previewUrl} title={`Preview ${usage.file.fileName}`} className="h-full w-full" />
      </div>
    );
  }
  return (
    <div className="grid h-44 place-items-center border-b border-white/10 bg-slate-950/50 text-sm text-slate-400">
      Preview no disponible
    </div>
  );
}

export default async function MaterialesPage() {
  const materials = await listFileAssetUsagesByTargetType("training_material", {
    slotPrefix: "training",
    limit: 200,
  });

  return (
    <section className="ui-card ui-card-pad min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Materiales</h1>
          <p className="mt-1 text-sm text-slate-300">
            Recursos de capacitación publicados desde R2.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
          {materials.length} recurso(s)
        </span>
      </div>

      {materials.length ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {materials.map((usage) => {
            const links = buildFileAssetLinks(usage.file.id);
            const size = formatFileSize(usage.file.sizeBytes);
            return (
              <article
                key={usage.id}
                className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/30"
              >
                <MaterialPreview usage={usage} />
                <div className="grid gap-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-200">
                      {materialKind(usage)}
                    </span>
                    {size ? <span className="text-xs text-slate-500">{size}</span> : null}
                  </div>
                  <div className="min-w-0 break-words font-semibold text-slate-100">
                    {usage.file.fileName}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={links.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ui-button-secondary min-h-[32px] rounded-full px-3 py-1 text-xs"
                    >
                      Abrir preview
                    </a>
                    <a
                      href={links.downloadUrl}
                      className="ui-button-info min-h-[32px] rounded-full px-3 py-1 text-xs"
                    >
                      Descargar
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-slate-950/30 px-4 py-8 text-sm text-slate-400">
          Sin materiales publicados.
        </div>
      )}
    </section>
  );
}
