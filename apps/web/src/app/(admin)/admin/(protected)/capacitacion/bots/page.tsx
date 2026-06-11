import {
  ROLEPLAY_ADVANCED_BOT_ENV_KEYS,
  getAdvancedRoleplayBotStatus,
} from "@/lib/roleplay-advanced-bot";
import {
  PRELOADED_ROLEPLAY_KNOWLEDGE,
  getRoleplayBotReply,
  listRoleplayBots,
  type RoleplayBotId,
  type RoleplayBotIntent,
} from "@/lib/sales-roleplay-bots";

import { assertTrainingAdminView } from "../actions";

export const dynamic = "force-dynamic";

const BOT_OPERATING_NOTES: Record<
  RoleplayBotId,
  {
    objective: string;
    pressure: string;
    evaluatorCue: string;
  }
> = {
  closing: {
    objective:
      "Empuja al asesor a resolver una objeción y pedir un siguiente paso concreto.",
    pressure:
      "Acepta avanzar cuando el asesor confirma monto, vigencia, requisito o cita sin sonar agresivo.",
    evaluatorCue:
      "Útil para practicar cierre consultivo, validación de datos y avance a documentos.",
  },
  non_closing: {
    objective:
      "Mantiene interés, pero abre nuevas dudas para medir paciencia, claridad y seguimiento.",
    pressure:
      "Evita comprometerse si el asesor presiona, promete demasiado o no aterriza el valor.",
    evaluatorCue:
      "Útil para practicar objeciones largas, seguimiento y recuperación de conversaciones frías.",
  },
};

const SAMPLE_ADVISOR_MESSAGES: Record<RoleplayBotId, string> = {
  closing:
    "La beca queda activa si hoy validamos tus datos y te paso la lista de documentos.",
  non_closing:
    "La promoción solo está disponible hoy, entonces necesito que me confirmes para apartarte.",
};

const CONFIGURATION_FILES = [
  {
    label: "Perfiles y conocimiento",
    path: "apps/web/src/lib/sales-roleplay-bots.ts",
    detail:
      "Editar PRELOADED_ROLEPLAY_KNOWLEDGE para agregar temas, detalles y disparadores.",
  },
  {
    label: "Panel de práctica",
    path: "apps/web/src/components/capacitacion/SalesRoleplayBotPanel.tsx",
    detail:
      "Ajustar textos del selector, composer y controles visibles para asesores.",
  },
  {
    label: "Guía operativa",
    path: "docs/ROLEPLAY_BOTS.md",
    detail:
      "Documentar nuevas reglas, ejemplos de objeciones y criterios de entrenamiento.",
  },
  {
    label: "Bot avanzado por API",
    path: "apps/web/src/lib/roleplay-advanced-bot.ts",
    detail:
      "Declarar proveedor, endpoint y modelo sin exponer tokens al navegador.",
  },
];

function intentLabel(intent: RoleplayBotIntent) {
  return intent === "moves_to_close" ? "Orientado a cierre" : "Resistente al cierre";
}

function intentTone(intent: RoleplayBotIntent) {
  return intent === "moves_to_close"
    ? "border-[#0f4c6b]/25 bg-[#0f4c6b]/10 text-[#0f4c6b]"
    : "border-[#8a5b00]/25 bg-[#fff7df] text-[#7a4f00]";
}

function AdminBotSection({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[26px] border border-[#c8d6e2] bg-white p-5 shadow-[0_16px_50px_rgb(16_32_42/0.06)]">
      <div className="mb-5">
        <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[#536a7c]">
          {kicker}
        </div>
        <h2 className="mt-2 text-xl font-black tracking-[-0.035em] text-[#102838]">
          {title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#536a7c]">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function ConfigPath({ path }: { path: string }) {
  return (
    <code className="block overflow-x-auto whitespace-nowrap rounded-[14px] border border-[#c8d6e2] bg-white px-3 py-2 text-xs font-bold leading-5 text-[#163247]">
      {path}
    </code>
  );
}

export default async function AdminTrainingBotsPage() {
  await assertTrainingAdminView();
  const advancedBotStatus = getAdvancedRoleplayBotStatus();

  const bots = listRoleplayBots().map((bot, index) => ({
    ...bot,
    reply: getRoleplayBotReply({
      botId: bot.id,
      advisorMessage: SAMPLE_ADVISOR_MESSAGES[bot.id],
      scenario: "admisiones, beca y documentos",
      turnIndex: index,
    }),
  }));

  return (
    <div className="grid gap-5 p-4 sm:p-5 lg:p-6">
      <section className="rounded-[28px] border border-[#c8d6e2] bg-white p-5 shadow-[0_18px_60px_rgb(16_32_42/0.07)]">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.36fr)]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#0f4c6b]/25 bg-[#0f4c6b]/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-[#0f4c6b]">
                Capacitación
              </span>
              <span className="rounded-full border border-[#c8d6e2] bg-[#f7fafc] px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em] text-[#536a7c]">
                Sin API de IA
              </span>
              <span
                className={[
                  "rounded-full border px-3 py-1 text-xs font-extrabold uppercase tracking-[0.16em]",
                  advancedBotStatus.enabled
                    ? "border-emerald-600/25 bg-emerald-50 text-emerald-700"
                    : "border-[#8a5b00]/25 bg-[#fff7df] text-[#7a4f00]",
                ].join(" ")}
              >
                {advancedBotStatus.enabled ? "API avanzada lista" : "API avanzada pendiente"}
              </span>
            </div>
            <div className="mt-4 text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[#536a7c]">
              Configuración local
            </div>
            <h1 className="mt-2 max-w-4xl text-3xl font-black leading-tight tracking-[-0.055em] text-[#102838] md:text-4xl">
              Bots precargados para entrenamiento de asesores.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#536a7c]">
              Los perfiles responden por reglas deterministas, detectan objeciones
              comunes y usan conocimiento local para sonar como prospectos reales
              durante la práctica de rolplay.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href="/admin/capacitacion"
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#c8d6e2] bg-[#f7fafc] px-4 text-sm font-extrabold text-[#163247] transition hover:bg-white"
              >
                Ver capacitación
              </a>
              <a
                href="/unidep/capacitacion/rolplay"
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#0f4c6b] bg-[#0f4c6b] px-4 text-sm font-extrabold text-white shadow-[0_12px_30px_rgb(15_76_107/0.16)] transition hover:bg-[#0b3d56]"
              >
                Probar en rolplay
              </a>
            </div>
          </div>

          <div className="grid gap-3 rounded-[22px] border border-[#c8d6e2] bg-[#f7fafc] p-4">
            <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.22em] text-[#536a7c]">
              Estado
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[18px] border border-[#c8d6e2] bg-white p-3">
                <div className="text-xs font-bold text-[#536a7c]">Bots</div>
                <div className="mt-1 text-xl font-black text-[#102838]">
                  {bots.length}
                </div>
              </div>
              <div className="rounded-[18px] border border-[#c8d6e2] bg-white p-3">
                <div className="text-xs font-bold text-[#536a7c]">
                  Conocimiento
                </div>
                <div className="mt-1 text-xl font-black text-[#102838]">
                  {PRELOADED_ROLEPLAY_KNOWLEDGE.length}
                </div>
              </div>
            </div>
            <div className="rounded-[18px] border border-[#c8d6e2] bg-white p-3 text-sm font-semibold leading-6 text-[#536a7c]">
              Configuración editable por código, sin llamadas externas ni
              generación dinámica por modelo.
            </div>
            <div className="rounded-[18px] border border-[#c8d6e2] bg-white p-3 text-sm leading-6 text-[#536a7c]">
              <div className="font-black text-[#102838]">Bot avanzado por API</div>
              <div className="mt-1 font-semibold">
                {advancedBotStatus.enabled
                  ? `Configurado para proveedor ${advancedBotStatus.provider}.`
                  : "Listo para activar cuando el endpoint y la clave existan en servidor."}
              </div>
              <div className="mt-2 grid gap-1 text-xs font-bold text-[#536a7c]">
                <span>
                  Endpoint:{" "}
                  {advancedBotStatus.endpointConfigured ? "configurado" : ROLEPLAY_ADVANCED_BOT_ENV_KEYS.apiUrl}
                </span>
                <span>
                  API key:{" "}
                  {advancedBotStatus.apiKeyConfigured ? "configurada" : ROLEPLAY_ADVANCED_BOT_ENV_KEYS.apiKey}
                </span>
                <span>
                  Modelo: {advancedBotStatus.model ?? ROLEPLAY_ADVANCED_BOT_ENV_KEYS.model}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AdminBotSection
        kicker="Perfiles activos"
        title="Comportamiento de los bots"
        description="Cada bot comparte el mismo detector de objeciones, pero cambia intención, tono y respuesta al intento de cierre."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {bots.map((bot) => {
            const notes = BOT_OPERATING_NOTES[bot.id];
            return (
              <article
                key={bot.id}
                className="rounded-[22px] border border-[#c8d6e2] bg-[#f7fafc] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-black tracking-[-0.035em] text-[#102838]">
                      {bot.name}
                    </div>
                    <div className="mt-1 text-xs font-extrabold uppercase tracking-[0.16em] text-[#536a7c]">
                      {bot.shortLabel}
                    </div>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-extrabold ${intentTone(
                      bot.intent,
                    )}`}
                  >
                    {intentLabel(bot.intent)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-sm leading-6 text-[#536a7c]">
                  <p>{bot.tone}</p>
                  <p>{notes.objective}</p>
                  <p>{notes.pressure}</p>
                </div>

                <div className="mt-4 rounded-[18px] border border-[#c8d6e2] bg-white p-4">
                  <div className="text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-[#536a7c]">
                    Respuesta de muestra
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#163247]">
                    {bot.reply.text}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-[#536a7c]">
                    <span className="rounded-full border border-[#c8d6e2] bg-[#f7fafc] px-3 py-1">
                      Objeción: {bot.reply.detectedObjection}
                    </span>
                    {bot.reply.usedKnowledge ? (
                      <span className="rounded-full border border-[#c8d6e2] bg-[#f7fafc] px-3 py-1">
                        Usa conocimiento local
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 rounded-[18px] border border-[#c8d6e2] bg-white p-4 text-sm font-semibold leading-6 text-[#536a7c]">
                  {notes.evaluatorCue}
                </div>
              </article>
            );
          })}
        </div>
      </AdminBotSection>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.45fr)]">
        <AdminBotSection
          kicker="Conocimiento base"
          title="Datos precargados"
          description="Estas entradas se usan como contexto fijo para que los prospectos respondan con referencias consistentes."
        >
          <div className="grid gap-3">
            {PRELOADED_ROLEPLAY_KNOWLEDGE.map((entry) => (
              <article
                key={entry.topic}
                className="rounded-[20px] border border-[#c8d6e2] bg-[#f7fafc] p-4"
              >
                <div className="text-sm font-black text-[#102838]">
                  {entry.topic}
                </div>
                <p className="mt-2 text-sm leading-6 text-[#536a7c]">
                  {entry.detail}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {entry.triggers.map((trigger) => (
                    <span
                      key={`${entry.topic}-${trigger}`}
                      className="rounded-full border border-[#c8d6e2] bg-white px-3 py-1 text-xs font-bold text-[#163247]"
                    >
                      {trigger}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </AdminBotSection>

        <AdminBotSection
          kicker="Mantenimiento"
          title="Dónde agregar conocimiento"
          description="La configuración queda en archivos versionados para que el comportamiento sea auditable y reproducible."
        >
          <div className="grid gap-3">
            {CONFIGURATION_FILES.map((file) => (
              <article
                key={file.path}
                className="rounded-[20px] border border-[#c8d6e2] bg-[#f7fafc] p-4"
              >
                <div className="text-sm font-black text-[#102838]">
                  {file.label}
                </div>
                <p className="mt-2 text-sm leading-6 text-[#536a7c]">
                  {file.detail}
                </p>
                <div className="mt-3">
                  <ConfigPath path={file.path} />
                </div>
              </article>
            ))}
          </div>
        </AdminBotSection>
      </div>
    </div>
  );
}
