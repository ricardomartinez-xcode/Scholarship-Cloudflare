export type RoleplayBotId = "closing" | "non_closing";

export type RoleplayObjection =
  | "price"
  | "schedule"
  | "trust"
  | "comparison"
  | "family"
  | "urgency"
  | "documents"
  | "financing"
  | "distance"
  | "online_quality"
  | "time_to_graduate"
  | "workload"
  | "default";

export type RoleplayBotIntent = "moves_to_close" | "resists_close";

export type RoleplayKnowledgeEntry = {
  topic: string;
  detail: string;
  triggers: string[];
};

export type RoleplayBotReply = {
  botId: RoleplayBotId;
  botName: string;
  detectedObjection: RoleplayObjection;
  intent: RoleplayBotIntent;
  text: string;
  usedKnowledge: string | null;
};

export type RoleplayReplyInput = {
  botId: RoleplayBotId;
  advisorMessage: string;
  scenario?: string | null;
  extraKnowledge?: string | readonly RoleplayKnowledgeEntry[] | null;
  turnIndex?: number;
};

type ObjectionCopy = Record<RoleplayObjection, readonly string[]>;

type RoleplayBotConfig = {
  id: RoleplayBotId;
  name: string;
  shortLabel: string;
  intent: RoleplayBotIntent;
  tone: string;
  openers: ObjectionCopy;
  challenges: ObjectionCopy;
  nextMoves: ObjectionCopy;
};

const OBJECTION_ORDER: readonly Exclude<RoleplayObjection, "default">[] = [
  "price",
  "schedule",
  "trust",
  "comparison",
  "family",
  "urgency",
  "documents",
  "financing",
  "distance",
  "online_quality",
  "time_to_graduate",
  "workload",
];

const OBJECTION_TRIGGERS: Record<Exclude<RoleplayObjection, "default">, readonly string[]> = {
  price: ["beca", "caro", "colegiatura", "costo", "descuento", "dinero", "mensualidad", "pagar", "precio"],
  schedule: ["horario", "horarios", "ocupado", "tiempo", "trabaja", "trabajo", "turno"],
  trust: ["confiar", "duda", "dudas", "estafa", "oficial", "reconocimiento", "rvoe", "seguro", "validez"],
  comparison: ["comparando", "comparar", "competencia", "opcion", "opciones", "otra", "universidad"],
  family: ["esposo", "esposa", "familia", "mama", "mamá", "papa", "papá", "papas", "papás", "pareja"],
  urgency: ["ahorita", "despues", "después", "hoy", "luego", "mañana", "pensar", "proximo", "próximo", "semana"],
  documents: ["acta", "certificado", "documento", "documentos", "ine", "inscripcion", "inscripción", "requisito", "requisitos"],
  financing: ["financiamiento", "pagos", "parcial", "quincena", "quincenal", "tarjeta", "enganche", "inscripcion", "inscripción"],
  distance: ["lejos", "distancia", "traslado", "camion", "camión", "gasolina", "plantel", "campus"],
  online_quality: ["online", "linea", "línea", "virtual", "plataforma", "calidad", "clases grabadas"],
  time_to_graduate: ["duracion", "duración", "terminar", "titular", "titularme", "años", "cuatrimestres"],
  workload: ["carga", "materias", "modulo", "módulo", "tareas", "examenes", "exámenes", "pesado"],
};

export const PRELOADED_ROLEPLAY_KNOWLEDGE: readonly RoleplayKnowledgeEntry[] = [
  { topic: "beca", detail: "La beca debe explicarse con vigencia, monto confirmado, condiciones y siguiente paso concreto para apartarla.", triggers: ["beca", "descuento", "mensualidad", "precio"] },
  { topic: "programa", detail: "Antes de pedir decisión, el asesor debe aterrizar programa, campus, modalidad, plan y ciclo para que el prospecto sienta certeza.", triggers: ["programa", "campus", "modalidad", "ciclo", "plan"] },
  { topic: "cierre", detail: "Un buen cierre pide un avance específico: validar datos, enviar documentos, agendar seguimiento o apartar lugar, no solo preguntar si le interesa.", triggers: ["cierre", "documentos", "seguimiento", "inscripcion"] },
  { topic: "tono", detail: "El prospecto responde mejor a empatía breve, claridad, cero presión agresiva y una pregunta de avance al final.", triggers: ["tono", "presion", "claro", "humano"] },
  { topic: "precio total", detail: "Cuando el prospecto objeta precio, conviene separar inscripción, mensualidad, beca, vigencia y costo total aproximado para quitar ambigüedad.", triggers: ["costo", "precio", "mensualidad", "total", "pagar"] },
  { topic: "valor antes de descuento", detail: "No vender solo por descuento: conectar el precio con modalidad, acompañamiento, flexibilidad, avance laboral y meta personal del estudiante.", triggers: ["valor", "descuento", "beneficio", "conviene"] },
  { topic: "horarios", detail: "Si el freno es horario, validar rutina laboral y ofrecer una opción concreta de turno/modalidad antes de cerrar.", triggers: ["horario", "trabajo", "turno", "ocupado"] },
  { topic: "familia", detail: "Cuando necesita consultar con familia, dar un resumen de 3 puntos para reenviar y pactar hora exacta de seguimiento.", triggers: ["familia", "pareja", "papas", "mamá", "papá"] },
  { topic: "confianza", detail: "Para dudas de confianza, responder con evidencia verificable: reconocimiento, canales oficiales, datos del campus y proceso por escrito.", triggers: ["confianza", "rvoe", "oficial", "validez", "seguro"] },
  { topic: "comparación", detail: "Si compara universidades, pedir criterio principal y contrastar con 3 variables: precio final, modalidad real y avance académico.", triggers: ["comparar", "opciones", "otra", "competencia"] },
  { topic: "urgencia sana", detail: "La urgencia debe basarse en vigencia real de beca, cupo o ciclo; evitar presión falsa y ofrecer apartar o revisar requisitos.", triggers: ["hoy", "mañana", "vigencia", "cupo", "ciclo"] },
  { topic: "documentos", detail: "Para documentos, listar indispensables, ordenar el primer envío y aclarar si puede avanzar con expediente parcial.", triggers: ["documentos", "acta", "certificado", "ine", "requisitos"] },
  { topic: "financiamiento", detail: "Si el problema es liquidez, explorar fecha de pago, monto inicial posible y alternativa de parcialidades sin prometer condiciones no confirmadas.", triggers: ["financiamiento", "pagos", "quincena", "enganche"] },
  { topic: "distancia", detail: "Cuando el campus queda lejos, conectar horarios, modalidad, rutas y frecuencia de asistencia para calcular esfuerzo real.", triggers: ["distancia", "lejos", "traslado", "campus", "plantel"] },
  { topic: "online", detail: "Para dudas sobre modalidad online, explicar plataforma, acompañamiento, entregables, comunicación y cómo se evalúa.", triggers: ["online", "virtual", "plataforma", "línea"] },
  { topic: "duración", detail: "Si pregunta duración, aterrizar plan, ritmo por ciclo/módulo y qué avance obtiene desde el primer periodo.", triggers: ["duración", "terminar", "años", "cuatrimestre"] },
  { topic: "carga académica", detail: "Cuando teme carga de materias, explicar materias por módulo, dedicación semanal aproximada y apoyo disponible.", triggers: ["materias", "carga", "tareas", "módulo", "exámenes"] },
  { topic: "seguimiento", detail: "Si no decide hoy, no dejar abierto: pactar fecha, hora y canal, con una tarea concreta para el prospecto y otra para el asesor.", triggers: ["después", "luego", "pensarlo", "seguimiento"] },
  { topic: "microcierre", detail: "Si el prospecto está frío, usar microcierres: confirmar programa, validar horario, enviar desglose o revisar documentos antes del cierre final.", triggers: ["no se", "no sé", "duda", "revisar"] },
  { topic: "objeción real", detail: "Antes de responder, detectar si la objeción es precio, confianza, tiempo o aprobación familiar; responder al freno real, no al síntoma.", triggers: ["pero", "duda", "problema", "freno"] },
];

const defaultOpeners = ["Va, te sigo.", "Mira, eso me ayuda.", "Ok, ya me queda más claro.", "Sí, entiendo el punto."];

const closingBot: RoleplayBotConfig = {
  id: "closing",
  name: "Agente de respuestas de texto",
  shortLabel: "Texto",
  intent: "moves_to_close",
  tone: "Interesado, cauteloso y dispuesto a avanzar si el asesor resuelve la duda.",
  openers: {
    price: ["Si la beca realmente queda así, ya suena más aterrizado.", "Con esa beca sí cambia bastante la decisión.", "El precio era mi freno principal; si eso está confirmado, me interesa."],
    schedule: ["Si puedo acomodarlo con mi trabajo, sí lo veo viable.", "El tema era el horario, no tanto las ganas.", "Si el turno me da margen, puedo avanzar."],
    trust: ["Me sirve que me lo digas claro, porque sí quería estar seguro.", "Eso me baja la duda, solo quiero evitar meterme a algo sin validez.", "Ok, si está respaldado, ya me da más confianza."],
    comparison: ["Estoy comparando, pero si me aclaras eso puedo decidir hoy.", "La otra opción me sigue dando vueltas, aunque esto ya se ve mejor.", "Si la diferencia real es esa, sí puedo inclinarme por ustedes."],
    family: ["Si se lo explico así a mi familia, creo que lo puedo mover.", "Necesito decirlo en casa, pero ya tengo argumentos.", "Va, si me das eso claro lo platico y avanzo."],
    urgency: ["No quiero hacerlo a la carrera, pero si tiene sentido puedo avanzar.", "Si hoy asegura algo real, puedo tomarlo en serio.", "Dame el siguiente paso claro y lo reviso ahorita."],
    documents: ["Los documentos sí los puedo juntar si me dices exactamente cuáles.", "Si ese es el requisito, no lo veo tan complicado.", "Puedo avanzar con documentos si me confirmas el orden."],
    financing: ["Si puedo acomodar el primer pago, sí me interesa avanzar.", "Con parcialidades se ve más viable.", "Si lo puedo empatar con mi quincena, lo puedo considerar."],
    distance: ["Si no tengo que ir diario, la distancia pesa menos.", "Con esa modalidad podría acomodar el traslado.", "Si el campus no me complica tanto, lo veo posible."],
    online_quality: ["Si la plataforma sí tiene acompañamiento, me da más confianza.", "Eso me ayuda porque online me preocupaba quedarme solo.", "Si está bien estructurado, la modalidad online sí puede servirme."],
    time_to_graduate: ["Si el plan me permite avanzar así, sí me interesa.", "Me ayuda saber cuánto tardaría realmente.", "Con esa ruta ya lo veo más concreto."],
    workload: ["Si la carga es manejable, puedo intentarlo.", "Eso me tranquiliza porque trabajo y no quiero saturarme.", "Si me organizo con esa carga, lo veo viable."],
    default: defaultOpeners,
  },
  challenges: {
    price: ["¿Me confirmas que esa mensualidad no cambia después?", "¿La beca queda apartada con qué paso exactamente?", "¿Qué tendría que pagar primero y qué queda pendiente?"],
    schedule: ["¿Qué pasa si una semana se me cruza el trabajo?", "¿El horario queda fijo o hay margen si trabajo?", "¿Cómo se organiza alguien que trabaja todo el día?"],
    trust: ["¿Dónde puedo validar eso sin vueltas?", "¿Me puedes decir cómo se comprueba la validez?", "¿Qué respaldo tengo si después me preguntan por el programa?"],
    comparison: ["¿Por qué me conviene esta opción contra la otra que estoy viendo?", "¿Qué perdería si me espero a comparar más?", "¿Cuál es la diferencia real, no solo el descuento?"],
    family: ["¿Cómo se lo explico a mi familia en dos frases?", "¿Qué dato les puedo enseñar para que no se preocupen?", "¿Me ayudas con el argumento para no venderles humo?"],
    urgency: ["¿Qué beneficio real pierdo si lo dejo para después?", "¿Hoy tengo que decidir todo o solo apartar el proceso?", "¿Cuál es el siguiente paso sin comprometerme de más?"],
    documents: ["¿Te mando primero documentos o revisamos datos?", "¿Qué documento es indispensable para empezar?", "Si me falta uno, ¿se puede avanzar algo?"],
    financing: ["¿Puedo iniciar con una parte y completar después?", "¿Qué fecha límite tendría para pagar?", "¿Hay forma de que no se me junte todo en un solo pago?"],
    distance: ["¿Cuántas veces tendría que ir al campus?", "¿Hay opción de hacer algo en línea para no trasladarme tanto?", "¿El plantel que me toca cuál sería exactamente?"],
    online_quality: ["¿Cómo sé que online no es solo dejarme tareas?", "¿Tendría seguimiento de alguien real?", "¿Cómo se resuelven dudas en línea?"],
    time_to_graduate: ["¿En cuánto tiempo real podría terminar?", "¿Qué pasa si bajo el ritmo un ciclo?", "¿Ese plan aplica para mi programa?"],
    workload: ["¿Cuántas materias llevaría al mismo tiempo?", "¿Cuántas horas a la semana debería dedicarle?", "¿Qué pasa si trabajo y una semana no avanzo igual?"],
    default: ["¿Qué paso concreto sigue?", "¿Qué necesitas de mí para dejarlo avanzado?", "¿Cómo quedaría si lo movemos hoy?"],
  },
  nextMoves: {
    price: ["Si me lo dejas por escrito y me dices cómo apartarlo, lo puedo avanzar.", "Si no cambia la mensualidad, puedo dar el siguiente paso.", "Con eso resuelto, dime qué necesitas para apartar."],
    schedule: ["Si el horario sí cuadra, puedo pasar a requisitos.", "Con esa flexibilidad, ya puedo revisar inscripción.", "Si me confirmas el turno, avanzamos con lo que siga."],
    trust: ["Si me mandas el respaldo, ya me siento más tranquilo para seguir.", "Con esa validación, puedo tomar la decisión con más seguridad.", "Si lo puedo verificar, avanzamos."],
    comparison: ["Si me resumes la diferencia, creo que ya puedo decidir.", "Si lo aterrizamos contra la otra opción, cierro la duda.", "Dame ese comparativo simple y lo movemos."],
    family: ["Si me das el resumen, lo platico y te confirmo hoy.", "Con eso puedo hablarlo en casa sin enredarme.", "Mándame esos puntos y te digo el siguiente paso."],
    urgency: ["Si hoy solo aparto y no me amarras de más, lo puedo hacer.", "Si el paso es pequeño y claro, lo avanzo.", "Dime qué dato te paso primero."],
    documents: ["Pásame la lista y empiezo con lo que ya tengo.", "Si ese es el orden, puedo juntar todo hoy.", "Dime cuál te mando primero."],
    financing: ["Si me acomodas el pago así, puedo avanzar.", "Con ese esquema sí lo veo posible.", "Dime cuánto tendría que cubrir primero."],
    distance: ["Si me confirmas la frecuencia de asistencia, puedo decidir.", "Con esa opción híbrida/online lo veo más fácil.", "Dime cuál campus y cómo sería la asistencia."],
    online_quality: ["Si me mandas cómo funciona la plataforma, avanzo con más confianza.", "Con acompañamiento sí puedo considerarlo.", "Dime cómo sería la primera semana."],
    time_to_graduate: ["Si esa ruta es real para mi plan, me interesa.", "Con ese tiempo estimado puedo decidir mejor.", "Dime cuándo iniciaría y cuándo terminaría aproximadamente."],
    workload: ["Si la carga es esa, puedo organizarme.", "Con ese ritmo sí lo intento.", "Dime cómo quedaría mi primer módulo."],
    default: ["Si me lo dejas claro, puedo avanzar.", "Va, dime el siguiente paso.", "Con eso sí me puedo mover hoy."],
  },
};

const nonClosingBot: RoleplayBotConfig = {
  ...closingBot,
  id: "non_closing",
  name: "Prospecto resistente al cierre",
  shortLabel: "No cierre",
  intent: "resists_close",
  tone: "Interesado en información, pero evita comprometerse y abre nuevas objeciones.",
  openers: {
    price: ["Entiendo lo de la beca, pero todavía se me hace pesado.", "Suena mejor con descuento, pero no quiero verlo solo por precio.", "Sí baja, ayuda, aunque igual tengo que revisar mis números."],
    schedule: ["El horario sigue siendo lo que más me preocupa.", "Si trabajo todo el día, no quiero quedar mal desde el inicio.", "Aun con opciones, me cuesta ver cómo lo acomodo."],
    trust: ["No digo que no, pero quiero validar bien antes de mover algo.", "Me sigue dando pendiente confiar solo con lo que me dices.", "Prefiero revisar el respaldo con calma."],
    comparison: ["Justo por eso quiero comparar un poco más.", "Traigo otra opción en mente y no quiero decidir rápido.", "Puede ser, pero todavía estoy viendo diferencias."],
    family: ["Tengo que hablarlo en casa antes de decirte que sí.", "Si no lo reviso con mi familia, luego se me complica.", "Mi pareja también opina en esto, entonces no puedo cerrarlo solo."],
    urgency: ["Ahorita prefiero no decidir bajo presión.", "Si lo tengo que hacer hoy, me frena más.", "Lo puedo revisar, pero no quiero comprometerme ahorita."],
    documents: ["Antes de mandar documentos quiero estar totalmente seguro.", "No quiero compartir papeles si todavía no decido.", "Los documentos los tengo, pero no quiero adelantarme."],
    financing: ["Aunque haya opción de pago, no quiero apretarme.", "No quiero iniciar si luego no puedo sostenerlo.", "Tengo que ver fechas y dinero antes de decir que sí."],
    distance: ["La distancia sigue pesando aunque haya opciones.", "No sé si el traslado me va a cansar mucho.", "Me preocupa que después se me complique ir."],
    online_quality: ["Online me interesa, pero me da miedo no aprender igual.", "No quiero pagar por algo donde me dejen solo.", "Me cuesta confiar en que online sí funcione para mí."],
    time_to_graduate: ["Suena bien, pero no quiero meterme a algo largo sin pensarlo.", "Necesito ver si ese tiempo realmente me conviene.", "No sé si pueda sostener ese ritmo hasta terminar."],
    workload: ["La carga me preocupa porque trabajo.", "No quiero saturarme con tareas y materias.", "Me da miedo empezar y no poder cumplir."],
    default: ["Te entiendo, pero todavía no me termina de convencer.", "Suena bien, solo que no quiero correrme.", "Lo veo, pero necesito pensarlo con calma."],
  },
  nextMoves: {
    price: ["Por ahora solo revisaría números y te diría después.", "Mándame el desglose y lo pienso, pero no te prometo cierre.", "Lo reviso con calma antes de mover algo."],
    schedule: ["Necesito ver mi semana antes de decidir.", "Pásame opciones, pero lo reviso sin compromiso.", "Primero quiero confirmar si mi rutina aguanta."],
    trust: ["Mándame el respaldo y después lo reviso.", "Prefiero validarlo antes de darte datos.", "Con evidencia puedo seguir hablando, pero todavía no cierro."],
    comparison: ["Déjame compararlo y te contesto después.", "Pásame el resumen y lo pongo contra la otra opción.", "No quiero cerrar hasta revisar ambas opciones."],
    family: ["Lo platico en casa y si avanzo te busco.", "Mándame la info para enseñarla, pero no cierro ahorita.", "Primero quiero escuchar qué me dicen."],
    urgency: ["Si se pierde el beneficio, lo entiendo, pero no quiero correr.", "Prefiero pensarlo aunque eso cambie la promoción.", "Hoy no te podría confirmar."],
    documents: ["Antes de mandar papeles quiero pensarlo.", "Primero reviso todo y después vemos documentos.", "No te mando documentos todavía."],
    financing: ["Déjame ver fechas de pago antes de decidir.", "No quiero comprometerme hasta estar seguro del dinero.", "Lo reviso y te digo si puedo."],
    distance: ["Primero quiero calcular bien el traslado.", "Déjame ver si realmente me conviene ese campus.", "No quiero avanzar si después se me complica ir."],
    online_quality: ["Mándame cómo funciona, pero lo reviso con calma.", "Quiero ver la plataforma antes de decidir.", "Necesito comprobar que sí hay apoyo."],
    time_to_graduate: ["Déjame revisar si ese tiempo me conviene.", "No quiero decidir sin entender bien la ruta completa.", "Primero quiero ver el plan."],
    workload: ["Necesito revisar si puedo con esa carga.", "Pásame el ejemplo de primer módulo y lo pienso.", "No quiero empezar si no voy a poder cumplir."],
    default: ["Lo reviso y te digo.", "No te digo que no, pero ahorita no cierro.", "Mándame la información y la comparo."],
  },
};

const ROLEPLAY_BOT_CONFIGS: readonly RoleplayBotConfig[] = [closingBot, nonClosingBot];

export function listRoleplayBots() {
  return ROLEPLAY_BOT_CONFIGS.map((bot) => ({
    id: bot.id,
    name: bot.name,
    shortLabel: bot.shortLabel,
    tone: bot.tone,
    intent: bot.intent,
  }));
}

export function getRoleplayBotConfig(botId: RoleplayBotId) {
  const bot = ROLEPLAY_BOT_CONFIGS.find((candidate) => candidate.id === botId);
  if (!bot) throw new Error(`Unknown roleplay bot: ${botId}`);
  return bot;
}

export function parseRoleplayKnowledge(
  input: string | readonly RoleplayKnowledgeEntry[] | null | undefined,
): RoleplayKnowledgeEntry[] {
  if (!input) return [];
  if (typeof input !== "string") {
    return input
      .filter((entry) => entry.topic.trim() && entry.detail.trim())
      .map((entry) => ({
        topic: entry.topic.trim(),
        detail: entry.detail.trim(),
        triggers: normalizeTriggerList(entry.triggers.join(" ")),
      }));
  }

  return input
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.search(/[:=–-]/);
      const topic = separatorIndex > 0 ? line.slice(0, separatorIndex).trim() : "General";
      const detail = separatorIndex > 0 ? line.slice(separatorIndex + 1).trim() : line;
      return { topic, detail, triggers: normalizeTriggerList(`${topic} ${detail}`) };
    })
    .filter((entry) => entry.detail.length > 0);
}

export function getRoleplayBotReply(input: RoleplayReplyInput): RoleplayBotReply {
  const bot = getRoleplayBotConfig(input.botId);
  const advisorMessage = input.advisorMessage.trim();
  const context = [advisorMessage, input.scenario ?? ""].join(" ");
  const objection = detectObjection(context);
  const extraKnowledge = parseRoleplayKnowledge(input.extraKnowledge);
  const usedKnowledge = selectKnowledge([...extraKnowledge, ...PRELOADED_ROLEPLAY_KNOWLEDGE], context, objection);
  const seed = `${bot.id}:${objection}:${input.turnIndex ?? 0}:${advisorMessage}`;
  const opener = pick(bot.openers[objection], seed);
  const challenge = pick(bot.challenges[objection], `${seed}:challenge`);
  const nextMove = pick(bot.nextMoves[objection], `${seed}:next`);
  const knowledgeBridge = usedKnowledge ? buildKnowledgeBridge(usedKnowledge, bot.intent, seed) : "";

  return {
    botId: bot.id,
    botName: bot.name,
    detectedObjection: objection,
    intent: bot.intent,
    text: [opener, knowledgeBridge, challenge, nextMove].filter(Boolean).join(" ").replace(/\s+/g, " ").trim(),
    usedKnowledge,
  };
}

function detectObjection(text: string): RoleplayObjection {
  const normalized = normalizeText(text);
  for (const objection of OBJECTION_ORDER) {
    if (OBJECTION_TRIGGERS[objection].some((trigger) => normalized.includes(normalizeText(trigger)))) {
      return objection;
    }
  }
  return "default";
}

function selectKnowledge(
  entries: readonly RoleplayKnowledgeEntry[],
  text: string,
  objection: RoleplayObjection,
) {
  const normalizedText = normalizeText(text);
  const objectionTriggers = objection === "default" ? [] : OBJECTION_TRIGGERS[objection].map(normalizeText);
  const match = entries.find((entry) => {
    const triggers = new Set([...entry.triggers, ...normalizeTriggerList(entry.topic)].map(normalizeText));
    return (
      Array.from(triggers).some((trigger) => normalizedText.includes(trigger)) ||
      objectionTriggers.some((trigger) => triggers.has(trigger))
    );
  });
  return match?.detail ?? null;
}

function buildKnowledgeBridge(knowledge: string, intent: RoleplayBotIntent, seed: string) {
  const cleanKnowledge = knowledge.replace(/[.]+$/, "");
  const closingBridges = [
    `Si eso aplica, me sirve que lo aterrices así: ${cleanKnowledge}.`,
    `Con ese dato ya puedo tomarlo más en serio: ${cleanKnowledge}.`,
    `Eso ayuda, solo dímelo sin vueltas: ${cleanKnowledge}.`,
  ];
  const resistingBridges = [
    `Aun así necesito revisarlo: ${cleanKnowledge}.`,
    `Eso suena bien, pero quiero verlo con calma: ${cleanKnowledge}.`,
    `Puede ayudar, aunque no me hace decidir todavía: ${cleanKnowledge}.`,
  ];
  return pick(intent === "moves_to_close" ? closingBridges : resistingBridges, `${seed}:knowledge`);
}

function normalizeTriggerList(text: string) {
  return Array.from(new Set(normalizeText(text).split(" ").filter((token) => token.length > 2)));
}

function normalizeText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pick<T>(items: readonly T[], seed: string): T {
  return items[Math.abs(hashString(seed)) % items.length];
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}
