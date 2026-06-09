from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")
    print(f"patched {path}")


def once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise RuntimeError(f"pattern not found: {label}")
    return text.replace(old, new, 1)


def regex_button(text: str, pattern: str, build, label: str) -> str:
    match = re.search(pattern, text, re.S)
    if not match:
        raise RuntimeError(f"regex not found: {label}")
    return text[: match.start()] + build(match) + text[match.end() :]


# prices importer backend
p = "apps/web/src/lib/importers/prices-csv.ts"
s = read(p)
s = once(
    s,
    '''export type PricesImportApplySummary = {
  processed: number;
  created: number;
  updated: number;
  unchanged: number;
};

type ParsedPriceRow = {''',
    '''export type PricesImportApplySummary = {
  processed: number;
  created: number;
  updated: number;
  unchanged: number;
};

export type PricesImportApplyMode = "replace" | "update-only";

type ParsedPriceRow = {''',
    "prices mode type",
)
s = once(
    s,
    '''export async function applyPreparedPricesImport(params: {
  payload: PreparedPricesImportPayload;
  updatedBy: string;
}): Promise<PricesImportApplySummary> {
  const rows = params.payload.rows ?? [];
  let created = 0;''',
    '''export async function applyPreparedPricesImport(params: {
  payload: PreparedPricesImportPayload;
  updatedBy: string;
  mode?: PricesImportApplyMode;
}): Promise<PricesImportApplySummary> {
  const rows = params.payload.rows ?? [];
  const mode = params.mode ?? "replace";
  let created = 0;''',
    "prices apply signature",
)
s = once(
    s,
    '''  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      if (row.action === "noop") {
        unchanged += 1;
        continue;
      }''',
    '''  await prisma.$transaction(async (tx) => {
    if (mode === "replace") {
      await tx.adminPriceOverride.deleteMany({ where: { scope: "base_price" } });
    }

    for (const row of rows) {
      if (mode === "update-only" && row.action === "create") {
        throw new PricesCsvValidationError(
          `Actualizar lote no puede crear precios nuevos. Revisa la fila ${row.rowNumber}.`,
          "UPDATE_ONLY_CANNOT_CREATE_PRICE",
        );
      }

      if (row.action === "noop" && mode !== "replace") {
        unchanged += 1;
        continue;
      }''',
    "prices transaction",
)
s = once(
    s,
    '''      let existingId = row.existingId ?? null;''',
    '''      let existingId = mode === "replace" ? null : row.existingId ?? null;''',
    "prices existing id",
)
write(p, s)

# prices apply route
p = "apps/web/src/app/api/admin/prices/import/[sessionId]/apply/route.ts"
s = read(p)
s = once(
    s,
    '''    const summary = await applyPreparedPricesImport({
      payload: session.payload as PreparedPricesImportPayload,
      updatedBy: auth.admin.email,
    });''',
    '''    const applyMode = new URL(request.url).searchParams.get("mode") === "update-only" ? "update-only" : "replace";
    const summary = await applyPreparedPricesImport({
      payload: session.payload as PreparedPricesImportPayload,
      updatedBy: auth.admin.email,
      mode: applyMode,
    });''',
    "prices route mode",
)
write(p, s)

# prices UI
p = "apps/web/src/components/admin/PricesClient.tsx"
s = read(p)
s = once(s, 'type PricePanel = "list" | "imports";', 'type PricePanel = "list" | "imports";\ntype PriceImportApplyMode = "replace" | "update-only";', "prices ui type")
s = once(s, 'async function applyImportSession() {', 'async function applyImportSession(mode: PriceImportApplyMode = "replace") {', "prices ui function")
s = once(s, 'const response = await fetch(`/api/admin/prices/import/${importSessionId}/apply`, {', 'const response = await fetch(`/api/admin/prices/import/${importSessionId}/apply?mode=${mode}`, {', "prices ui url")
s = re.sub(r'\{ id: "imports", label: "Importaci.n" \}', '{ id: "imports", label: "Actualizacion" }', s)
s = s.replace('Importar precio lista', 'Actualizar precios')
s = s.replace('Importa archivos XLSX o CSV con el orden canonico de precio. Se genera preview', 'Carga archivos XLSX o CSV. Actualizar precios reemplaza los anteriores; Actualizar lote solo modifica existentes.')
prices_button_pattern = r'<button\s+type="button"\s+onClick=\{applyImportSession\}\s+disabled=\{Boolean\(\s*!importSessionId \|\| applyImportLoading \|\| importSummary\?\.errors\?\.length,\s*\)\}\s+className="([^"]+)"\s*>\s*\{applyImportLoading \? "Aplicando\.\.\." : "Aplicar"\}\s*</button>'
def prices_buttons(m):
    cls = m.group(1)
    return f'''<button
              type="button"
              onClick={{() => void applyImportSession("replace")}}
              disabled={{Boolean(
                !importSessionId || applyImportLoading || importSummary?.errors?.length,
              )}}
              className="{cls}"
            >
              {{applyImportLoading ? "Actualizando..." : "Actualizar precios"}}
            </button>
            <button
              type="button"
              onClick={{() => void applyImportSession("update-only")}}
              disabled={{Boolean(
                !importSessionId || applyImportLoading || importSummary?.errors?.length,
              )}}
              className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/25 disabled:opacity-60"
            >
              {{applyImportLoading ? "Actualizando..." : "Actualizar lote"}}
            </button>'''
s = regex_button(s, prices_button_pattern, prices_buttons, "prices buttons")
write(p, s)

# offer importer backend
p = "apps/web/src/lib/importers/academic-offer-replace.ts"
s = read(p)
s = once(
    s,
    '''export type { PreparedAcademicOfferImportPayload } from "./academic-offer";

type ParsedCampus = PreparedAcademicOfferImportPayload["parsed"][number];''',
    '''export type { PreparedAcademicOfferImportPayload } from "./academic-offer";

export type AcademicOfferImportApplyMode = "replace" | "update-only";

type ParsedCampus = PreparedAcademicOfferImportPayload["parsed"][number];''',
    "offer mode type",
)
s = once(
    s,
    '''async function upsertProgramsForImport(
  seeds: Map<string, ProgramSeed>,
  summary: ImportAcademicOfferSummary,
): Promise<ProgramIdByNormalizedName> {''',
    '''async function upsertProgramsForImport(
  seeds: Map<string, ProgramSeed>,
  summary: ImportAcademicOfferSummary,
  options?: { allowCreate?: boolean },
): Promise<ProgramIdByNormalizedName> {''',
    "offer upsert signature",
)
s = once(
    s,
    '''    if (!existing) {
      const created = await prisma.program.create({''',
    '''    if (!existing) {
      if (options?.allowCreate === false) {
        throw new Error(`Actualizar lote no puede crear programas nuevos: ${program.name}.`);
      }

      const created = await prisma.program.create({''',
    "offer program create guard",
)
s = once(
    s,
    '''export async function applyPreparedAcademicOfferImport(params: {
  payload: PreparedAcademicOfferImportPayload;
  updatedBy: string;
}): Promise<ImportAcademicOfferSummary> {''',
    '''export async function applyPreparedAcademicOfferImport(params: {
  payload: PreparedAcademicOfferImportPayload;
  updatedBy: string;
  mode?: AcademicOfferImportApplyMode;
}): Promise<ImportAcademicOfferSummary> {''',
    "offer apply signature",
)
s = once(
    s,
    '''  const programSeeds = getProgramSeeds(params.payload);
  const programIds = await upsertProgramsForImport(programSeeds, summary);
  const replacementRows = buildReplacementOfferRows(params.payload, programIds);''',
    '''  const mode = params.mode ?? "replace";
  const programSeeds = getProgramSeeds(params.payload);
  const programIds = await upsertProgramsForImport(programSeeds, summary, {
    allowCreate: mode !== "update-only",
  });
  const replacementRows = buildReplacementOfferRows(params.payload, programIds);''',
    "offer mode setup",
)
offer_update_only = '''    if (mode === "update-only") {
      const updatedByCampus = new Map<string, number>();

      for (const item of replacementRows) {
        const existing = await tx.programOffering.findFirst({
          where: {
            cycle: params.payload.cycle,
            campusId: item.campusId,
            programId: item.programId,
            track: item.row.module,
          },
          select: { id: true },
        });

        if (!existing) {
          throw new Error(
            `Actualizar lote no puede crear oferta nueva: ${item.campusName} - ${item.row.programName} - ${item.row.module}.`,
          );
        }

        const isOnline = item.row.delivery === "ONLINE";
        await tx.programOffering.update({
          where: { id: existing.id },
          data: {
            delivery: isOnline
              ? ProgramOfferingDelivery.ONLINE
              : ProgramOfferingDelivery.CAMPUS,
            escolarizado: isOnline ? false : item.row.escolarizado,
            ejecutivo: isOnline ? false : item.row.ejecutivo,
            escolarizadoSchedule: isOnline ? null : item.row.escolarizadoSchedule,
            ejecutivoSchedule: isOnline ? null : item.row.ejecutivoSchedule,
            lineOfBusiness: item.row.lineOfBusiness,
            pricingPlans: item.row.pricingPlans ?? [],
            track: item.row.module,
            moduleCount: item.row.moduleCount,
            subjectsByModule: item.row.subjectsByModule,
            isActive: true,
            archivedAt: null,
            archivedReason: null,
            updatedBy: params.updatedBy,
          },
        });

        summary.offerings.updated += 1;
        updatedByCampus.set(item.campusId, (updatedByCampus.get(item.campusId) ?? 0) + 1);
      }

      summary.campusesProcessed = params.payload.parsed.length;
      for (const campus of params.payload.parsed) {
        summary.perCampus.push({
          campusCode: campus.campusCode,
          campusName: campus.campusNameFromExcel ?? campus.campusCode,
          sheetName: campus.sheetName,
          source: campus.source,
          rows: campus.rows.length,
          offeringsCreated: 0,
          offeringsUpdated: updatedByCampus.get(campus.campusId) ?? 0,
          offeringsReactivated: 0,
          offeringsDeactivated: 0,
        });
      }

      return;
    }

'''
s = once(
    s,
    '''    const deleted = await tx.programOffering.deleteMany({
      where: { cycle: params.payload.cycle },
    });

    if (replacementRows.length > 0) {''',
    offer_update_only + '''    const deleted = await tx.programOffering.deleteMany({
      where: { cycle: params.payload.cycle },
    });

    if (replacementRows.length > 0) {''',
    "offer update only block",
)
write(p, s)

# offer apply route
p = "apps/web/src/app/api/admin/import-academic-offer/[sessionId]/apply/route.ts"
s = read(p)
s = once(
    s,
    '''    const summary = await applyPreparedAcademicOfferImport({
      payload: session.payload as unknown as PreparedAcademicOfferImportPayload,
      updatedBy: admin.email,
    });''',
    '''    const applyMode = new URL(request.url).searchParams.get("mode") === "update-only" ? "update-only" : "replace";
    const summary = await applyPreparedAcademicOfferImport({
      payload: session.payload as unknown as PreparedAcademicOfferImportPayload,
      updatedBy: admin.email,
      mode: applyMode,
    });''',
    "offer route mode",
)
s = s.replace('replacementMode: true', 'replacementMode: applyMode === "replace",\n        applyMode')
write(p, s)

# offer UI
p = "apps/web/src/components/admin/OfferImportClient.tsx"
s = read(p)
s = once(s, 'type OfferPanel = "list" | "imports";', 'type OfferPanel = "list" | "imports";\ntype OfferImportApplyMode = "replace" | "update-only";', "offer ui type")
s = once(s, 'async function applyImport() {', 'async function applyImport(mode: OfferImportApplyMode = "replace") {', "offer ui function")
s = once(s, 'fetch(`/api/admin/import-academic-offer/${sessionId}/apply`, { method: "POST" });', 'fetch(`/api/admin/import-academic-offer/${sessionId}/apply?mode=${mode}`, { method: "POST" });', "offer ui url")
s = re.sub(r'\{ id: "imports", label: "Importaci.n" \}', '{ id: "imports", label: "Actualizacion" }', s)
s = s.replace('Importar oferta por planteles', 'Actualizar oferta por planteles')
s = s.replace('importa cambios masivos por XLSX/CSV', 'actualiza oferta por reemplazo o lote desde XLSX/CSV')
s = s.replace('Ciclo a importar', 'Ciclo a actualizar')
offer_button_pattern = r'\{sessionId && !applied && !rolledBack \? <button type="button" onClick=\{applyImport\} disabled=\{applyLoading\} className="([^"]+)"\>\{applyLoading \? "Aplicando\.\.\." : "Aplicar al draft"\}</button> : null\}'
def offer_buttons(m):
    cls = m.group(1)
    return f'''{{sessionId && !applied && !rolledBack ? (
                  <>
                    <button type="button" onClick={{() => void applyImport("replace")}} disabled={{applyLoading}} className="{cls}">
                      {{applyLoading ? "Actualizando..." : "Actualizar oferta"}}
                    </button>
                    <button type="button" onClick={{() => void applyImport("update-only")}} disabled={{applyLoading}} className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/25 disabled:opacity-60">
                      {{applyLoading ? "Actualizando..." : "Actualizar lote"}}
                    </button>
                  </>
                ) : null}}'''
s = regex_button(s, offer_button_pattern, offer_buttons, "offer buttons")
s = s.replace('aplicada al draft', 'actualizada')
write(p, s)
