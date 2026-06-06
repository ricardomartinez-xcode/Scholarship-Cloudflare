export type RoleplayBotId = "closing" | "non_closing";

export type RoleplayObjection =
  | "price"
  | "schedule"
  | "trust"
  | "comparison"
  | "family"
  | "urgency"
  | "documents"
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
];

const OBJECTION_TRIGGERS: Record<Exclude<RoleplayObjection, "default">, readonly string[]> = {
  price: [
    "beca",
    "caro",
    "costo",
    "colegiatura",
    "descuento",
    "dinero",
    "mensualidad",
    "pagar",
    "precio",
  ],
  schedule: [
    "horario",
    "horarios",
    "ocupado",
    "tiempo",
    "trabaja",
    "trabajo",
    "turno",
  ],
  trust: [
    "confiar",
    "duda",
    "dudas",
    "estafa",
    "oficial",
    "reconocimiento",
    "rvoe",
    "seguro",
    "validez",
  ],
  comparison: [
    "comparando",
    "comparar",
    "competencia",
    "opcion",
    "opciones",
    "otra",
    "universidad",
  ],
  family: [
    "esposo",
    "esposa",
    "familia",
    "mama",
    "papa",
    "papas",
    "pareja",
  ],
  urgency: [
    "ahorita",
    "despues",
    "hoy",
    "luego",
    "manana",
    "pensar",
    "proximo",
    "semana",
  ],
  documents: [
    "acta",
    "certificado",
    "documento",
    "documentos",
    "ine",
    "inscripcion",
    "requisito",
    "requisitos",
  ],
};

export const PRELOADED_ROLEPLAY_KNOWLEDGE: readonly RoleplayKnowledgeEntry[] = [
  {
    topic: "beca",
    detail:
      "La beca debe explicarse con vigencia, siguiente paso y monto confirmado por el asesor.",
    triggers: ["beca", "descuento", "mensualidad", "precio"],
  },
  {
    topic: "programa",
    detail:
      "El asesor debe aterrizar programa, campus, modalidad y ciclo antes de pedir decision.",
    triggers: ["programa", "campus", "modalidad", "ciclo"],
  },
  {
    topic: "cierre",
    detail:
      "El cierre debe pedir un avance concreto: documentos, validacion de datos o cita de seguimiento.",
    triggers: ["cierre", "documentos", "seguimiento", "inscripcion"],
  },
  {
    topic: "tono",
    detail:
      "El prospecto reacciona mejor a respuestas claras, humanas y sin presion agresiva.",
    triggers: ["tono", "presion", "claro", "humano"],
  },
];

const defaultOpeners = [
  "Va, te sigo.",
  "Mira, eso me ayuda.",
  "Ok, ya me queda mas claro.",
  "Si, entiendo el punto.",
];

const closingBot: RoleplayBotConfig = {
  id: "closing",
  name: "Prospecto orientado a cierre",
  shortLabel: "Cierre",
  intent: "moves_to_close",
  tone: "Interesado, cauteloso y dispuesto a avanzar si el asesor resuelve la duda.",
  openers: {
    price: [
      "Si la beca realmente queda asi, ya suena mas aterrizado.",
      "Con esa beca si cambia bastante la decision.",
      "El precio era mi freno principal; si eso esta confirmado, me interesa.",
    ],
    schedule: [
      "Si puedo acomodarlo con mi trabajo, si lo veo viable.",
      "El tema era el horario, no tanto las ganas.",
      "Si el turno me da margen, puedo avanzar.",
    ],
    trust: [
      "Me sirve que me lo digas claro, porque si queria estar seguro.",
      "Eso me baja la duda, solo quiero evitar meterme a algo sin validez.",
      "Ok, si esta respaldado, ya me da mas confianza.",
    ],
    comparison: [
      "Estoy comparando, pero si me aclaras eso puedo decidir hoy.",
      "La otra opcion me sigue dando vueltas, aunque esto ya se ve mejor.",
      "Si la diferencia real es esa, si puedo inclinarme por ustedes.",
    ],
    family: [
      "Si se lo explico asi a mi familia, creo que lo puedo mover.",
      "Necesito decirlo en casa, pero ya tengo argumentos.",
      "Va, si me das eso claro lo platico y avanzo.",
    ],
    urgency: [
      "No quiero hacerlo a la carrera, pero si tiene sentido avanzar.",
      "Si hoy asegura algo real, puedo tomarlo en serio.",
      "Dame el siguiente paso claro y lo reviso ahorita.",
    ],
    documents: [
      "Los documentos si los puedo juntar si me dices exactamente cuales.",
      "Si ese es el requisito, no lo veo tan complicado.",
      "Puedo avanzar con documentos si me confirmas el orden.",
    ],
    default: defaultOpeners,
  },
  challenges: {
    price: [
      "¿Me confirmas que esa mensualidad no cambia despues?",
      "¿La beca queda apartada con que paso exactamente?",
      "¿Que tendria que pagar primero y que queda pendiente?",
    ],
    schedule: [
      "¿Que pasa si una semana se me cruza el trabajo?",
      "¿El horario queda fijo o hay margen si trabajo?",
      "¿Como se organiza alguien que trabaja todo el dia?",
    ],
    trust: [
      "¿Donde puedo validar eso sin vueltas?",
      "¿Me puedes decir como se comprueba la validez?",
      "¿Que respaldo tengo si despues me preguntan por el programa?",
    ],
    comparison: [
      "¿Por que me conviene esta opcion contra la otra que estoy viendo?",
      "¿Que perderia si me espero a comparar mas?",
      "¿Cual es la diferencia real, no solo el descuento?",
    ],
    family: [
      "¿Como se lo explico a mi familia en dos frases?",
      "¿Que dato les puedo ensenar para que no se preocupen?",
      "¿Me ayudas con el argumento para no venderles humo?",
    ],
    urgency: [
      "¿Que beneficio real pierdo si lo dejo para despues?",
      "¿Hoy tengo que decidir todo o solo apartar el proceso?",
      "¿Cual es el siguiente paso sin comprometerme de mas?",
    ],
    documents: [
      "¿Te mando primero documentos o revisamos datos?",
      "¿Que documento es indispensable para empezar?",
      "¿Si me falta uno, se puede avanzar algo?",
    ],
    default: [
      "¿Que paso concreto sigue?",
      "¿Que necesitas de mi para dejarlo avanzado?",
      "¿Como quedaria si lo movemos hoy?",
    ],
  },
  nextMoves: {
    price: [
      "Si me lo dejas por escrito y me dices como apartarlo, lo puedo avanzar.",
      "Si no cambia la mensualidad, puedo dar el siguiente paso.",
      "Con eso resuelto, dime que necesitas para apartar.",
    ],
    schedule: [
      "Si el horario si cuadra, puedo pasar a requisitos.",
      "Con esa flexibilidad, ya puedo revisar inscripcion.",
      "Si me confirmas el turno, avanzamos con lo que siga.",
    ],
    trust: [
      "Si me mandas el respaldo, ya me siento mas tranquilo para seguir.",
      "Con esa validacion, puedo tomar la decision con mas seguridad.",
      "Si lo puedo verificar, avanzamos.",
    ],
    comparison: [
      "Si me resumes la diferencia, creo que ya puedo decidir.",
      "Si lo aterrizamos contra la otra opcion, cierro la duda.",
      "Dame ese comparativo simple y lo movemos.",
    ],
    family: [
      "Si me das el resumen, lo platico y te confirmo hoy.",
      "Con eso puedo hablarlo en casa sin enredarme.",
      "Mandame esos puntos y te digo el siguiente paso.",
    ],
    urgency: [
      "Si hoy solo aparto y no me amarras de mas, lo puedo hacer.",
      "Si el paso es pequeno y claro, lo avanzo.",
      "Dime que dato te paso primero.",
    ],
    documents: [
      "Pasame la lista y empiezo con lo que ya tengo.",
      "Si ese es el orden, puedo juntar todo hoy.",
      "Dime cual te mando primero.",
    ],
    default: [
      "Si me lo dejas claro, puedo avanzar.",
      "Va, dime el siguiente paso.",
      "Con eso si me puedo mover hoy.",
    ],
  },
};

const nonClosingBot: RoleplayBotConfig = {
  id: "non_closing",
  name: "Prospecto resistente al cierre",
  shortLabel: "No cierre",
  intent: "resists_close",
  tone: "Interesado en informacion, pero evita comprometerse y abre nuevas objeciones.",
  openers: {
    price: [
      "Entiendo lo de la beca, pero todavia se me hace pesado.",
      "Suena mejor con descuento, pero no quiero verlo solo por precio.",
      "Si baja, ayuda, aunque igual tengo que revisar mis numeros.",
    ],
    schedule: [
      "El horario sigue siendo lo que mas me preocupa.",
      "Si trabajo todo el dia, no quiero quedar mal desde el inicio.",
      "Aun con opciones, me cuesta ver como lo acomodo.",
    ],
    trust: [
      "No digo que no, pero quiero validar bien antes de mover algo.",
      "Me sigue dando pendiente confiar solo con lo que me dices.",
      "Prefiero revisar el respaldo con calma.",
    ],
    comparison: [
      "Justo por eso quiero comparar un poco mas.",
      "Traigo otra opcion en mente y no quiero decidir rapido.",
      "Puede ser, pero todavia estoy viendo diferencias.",
    ],
    family: [
      "Tengo que hablarlo en casa antes de decirte que si.",
      "Si no lo reviso con mi familia, luego se me complica.",
      "Mi pareja tambien opina en esto, entonces no puedo cerrarlo solo.",
    ],
    urgency: [
      "Ahorita prefiero no decidir bajo presion.",
      "Si lo tengo que hacer hoy, me frena mas.",
      "Lo puedo revisar, pero no quiero comprometerme ahorita.",
    ],
    documents: [
      "Antes de mandar documentos quiero estar totalmente seguro.",
      "No quiero compartir papeles si todavia no decido.",
      "Los documentos los tengo, pero no quiero adelantarme.",
    ],
    default: [
      "Te entiendo, pero todavia no me termina de convencer.",
      "Suena bien, solo que no quiero correrme.",
      "Lo veo, pero necesito pensarlo con calma.",
    ],
  },
  challenges: {
    price: [
      "¿Que pasa si despues encuentro algo mas barato?",
      "¿Me puedes explicar el costo total, no solo la mensualidad?",
      "¿Y si el siguiente mes ya no puedo sostener ese pago?",
    ],
    schedule: [
      "¿Y si mi trabajo cambia de turno?",
      "¿No se vuelve demasiado pesado junto con mi rutina?",
      "¿Que pasa si falto por trabajo?",
    ],
    trust: [
      "¿Como se que no me estas diciendo solo lo necesario para cerrar?",
      "¿Puedo revisarlo yo antes de darte una respuesta?",
      "¿Que evidencia me puedes mandar para validarlo?",
    ],
    comparison: [
      "¿Por que no deberia esperar a que me responda la otra escuela?",
      "¿Que tiene esto que no tenga la otra opcion?",
      "¿No me conviene comparar planes completos primero?",
    ],
    family: [
      "¿Y si en casa me dicen que mejor espere?",
      "¿Que les digo si me preguntan por el gasto?",
      "¿Puedo verlo con ellos y te busco despues?",
    ],
    urgency: [
      "¿Por que tendria que ser hoy?",
      "¿Que pasa si te confirmo la proxima semana?",
      "¿No puedo dejarlo para manana y pensarlo bien?",
    ],
    documents: [
      "¿Para que necesitas documentos antes de que yo decida?",
      "¿Puedo revisar todo antes de mandar nada?",
      "¿Que seguridad tengo al compartirlos?",
    ],
    default: [
      "¿Me puedes dar mas contexto sin presionarme?",
      "¿Que pasa si lo dejo pendiente?",
      "¿Puedo revisarlo y escribirte despues?",
    ],
  },
  nextMoves: {
    price: [
      "Por ahora solo revisaria numeros y te diria despues.",
      "Mandame el desglose y lo pienso, pero no te prometo cierre.",
      "Lo reviso con calma antes de mover algo.",
    ],
    schedule: [
      "Necesito ver mi semana antes de decidir.",
      "Pasame opciones, pero lo reviso sin compromiso.",
      "Primero quiero confirmar si mi rutina aguanta.",
    ],
    trust: [
      "Mandame el respaldo y despues lo reviso.",
      "Prefiero validarlo antes de darte datos.",
      "Con evidencia puedo seguir hablando, pero todavia no cierro.",
    ],
    comparison: [
      "Dejame compararlo y te contesto despues.",
      "Pasame el resumen y lo pongo contra la otra opcion.",
      "No quiero cerrar hasta revisar ambas opciones.",
    ],
    family: [
      "Lo platico en casa y si avanzo te busco.",
      "Mandame la info para ensenarla, pero no cierro ahorita.",
      "Primero quiero escuchar que me dicen.",
    ],
    urgency: [
      "Si se pierde el beneficio, lo entiendo, pero no quiero correr.",
      "Prefiero pensarlo aunque eso cambie la promocion.",
      "Hoy no te podria confirmar.",
    ],
    documents: [
      "Antes de mandar papeles quiero pensarlo.",
      "Primero reviso todo y despues vemos documentos.",
      "No te mando documentos todavia.",
    ],
    default: [
      "Lo reviso y te digo.",
      "No te digo que no, pero ahorita no cierro.",
      "Mandame la informacion y la comparo.",
    ],
  },
};

const ROLEPLAY_BOT_CONFIGS: readonly RoleplayBotConfig[] = [
  closingBot,
  nonClosingBot,
];

export function listRoleplayBots() {
  return ROLEPLAY_BOT_CONFIGS.map((bot) => ({
    id: bot.id,
    name: bot.name,
    shortLabel: bot.shortLabel,
    tone: bot.tone,
    intent: bot.intent,
  }));
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
      const separatorIndex = line.search(/[:=-]/);
      const topic =
        separatorIndex > 0 ? line.slice(0, separatorIndex).trim() : "General";
      const detail =
        separatorIndex > 0 ? line.slice(separatorIndex + 1).trim() : line;
      return {
        topic,
        detail,
        triggers: normalizeTriggerList(`${topic} ${detail}`),
      };
    })
    .filter((entry) => entry.detail.length > 0);
}

export function getRoleplayBotReply(input: RoleplayReplyInput): RoleplayBotReply {
  const bot = ROLEPLAY_BOT_CONFIGS.find((candidate) => candidate.id === input.botId);
  if (!bot) {
    throw new Error(`Unknown roleplay bot: ${input.botId}`);
  }

  const advisorMessage = input.advisorMessage.trim();
  const context = [advisorMessage, input.scenario ?? ""].join(" ");
  const objection = detectObjection(context);
  const extraKnowledge = parseRoleplayKnowledge(input.extraKnowledge);
  const usedKnowledge = selectKnowledge(
    [...extraKnowledge, ...PRELOADED_ROLEPLAY_KNOWLEDGE],
    context,
    objection,
  );
  const seed = `${bot.id}:${objection}:${input.turnIndex ?? 0}:${advisorMessage}`;
  const opener = pick(bot.openers[objection], seed);
  const challenge = pick(bot.challenges[objection], `${seed}:challenge`);
  const nextMove = pick(bot.nextMoves[objection], `${seed}:next`);
  const knowledgeBridge = usedKnowledge
    ? buildKnowledgeBridge(usedKnowledge, bot.intent, seed)
    : "";

  return {
    botId: bot.id,
    botName: bot.name,
    detectedObjection: objection,
    intent: bot.intent,
    text: [opener, knowledgeBridge, challenge, nextMove]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
    usedKnowledge,
  };
}

function detectObjection(text: string): RoleplayObjection {
  const normalized = normalizeText(text);
  for (const objection of OBJECTION_ORDER) {
    if (OBJECTION_TRIGGERS[objection].some((trigger) => normalized.includes(trigger))) {
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
  const objectionTriggers = getObjectionTriggers(objection);
  const match = entries.find((entry) => {
    const triggers = new Set([...entry.triggers, ...normalizeTriggerList(entry.topic)]);
    return (
      Array.from(triggers).some((trigger) => normalizedText.includes(trigger)) ||
      objectionTriggers.some((trigger) => triggers.has(trigger))
    );
  });
  return match?.detail ?? null;
}

function getObjectionTriggers(objection: RoleplayObjection) {
  return objection === "default" ? [] : OBJECTION_TRIGGERS[objection];
}

function buildKnowledgeBridge(
  knowledge: string,
  intent: RoleplayBotIntent,
  seed: string,
) {
  const cleanKnowledge = knowledge.replace(/[.]+$/, "");
  const closingBridges = [
    `Si eso aplica, me sirve que lo aterrices asi: ${cleanKnowledge}.`,
    `Con ese dato ya puedo tomarlo mas en serio: ${cleanKnowledge}.`,
    `Eso ayuda, solo dimelo sin vueltas: ${cleanKnowledge}.`,
  ];
  const resistingBridges = [
    `Aun asi necesito revisarlo: ${cleanKnowledge}.`,
    `Eso suena bien, pero quiero verlo con calma: ${cleanKnowledge}.`,
    `Puede ayudar, aunque no me hace decidir todavia: ${cleanKnowledge}.`,
  ];
  return pick(
    intent === "moves_to_close" ? closingBridges : resistingBridges,
    `${seed}:knowledge`,
  );
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
