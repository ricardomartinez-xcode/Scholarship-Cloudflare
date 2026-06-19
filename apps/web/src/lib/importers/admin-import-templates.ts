export type AdminImportTemplateFormat = "csv" | "xlsx";

export type AdminImportTemplate = {
  id: string;
  label: string;
  description: string;
  moduleLabel: string;
  format: AdminImportTemplateFormat;
  fileName: string;
  headers: string[];
  rows: string[][];
  notes: string[];
};

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function buildCsvTemplate(template: AdminImportTemplate) {
  const lines = [template.headers, ...template.rows].map((row) => row.map(csvEscape).join(","));
  return `${lines.join("\n")}\n`;
}

export const ADMIN_IMPORT_TEMPLATES = [
  {
    id: "prices",
    label: "Precios",
    description: "Carga precios por alcance, programa, nivel, modalidad, plan y tier.",
    moduleLabel: "Precios",
    format: "csv",
    fileName: "plantilla-precios.csv",
    headers: ["alcance", "region", "plantel", "programa", "nivel", "modalidad", "plan", "modulo", "tier", "precio", "precio_por_materia", "activo", "notas"],
    rows: [
      ["general", "Nacional", "", "", "licenciatura", "presencial", "11", "M1", "", "3500", "", "Activo", "Precio general"],
      ["programa + plantel + tier", "Sonora", "Hermosillo", "Psicologia", "licenciatura", "presencial", "11", "M2", "T3", "4970", "1250", "Activo", "Precio por programa/plantel/tier"],
    ],
    notes: [
      "alcance acepta general, programa, plantel, tier o combinaciones como programa + plantel + tier.",
      "nivel acepta licenciatura, salud, preparatoria/bachillerato o posgrado/maestria; modalidad acepta presencial/escolarizada, ejecutiva/mixta u online.",
      "plan debe ser el número que usa el cotizador; precio y precio_por_materia deben ser numéricos, sin símbolo de moneda.",
      "activo acepta Activo/Inactivo, true/false, si/no, 1/0.",
    ],
  },
  {
    id: "benefits",
    label: "Beneficios",
    description: "Carga beneficios adicionales por alcance, tipo, ingreso, modalidad y duración.",
    moduleLabel: "Beneficios",
    format: "csv",
    fileName: "plantilla-beneficios.csv",
    headers: ["linea_negocio", "planteles", "tipo_beneficio", "tipo_ingreso", "modalidad", "duracion", "porcentaje_adicional", "estado", "notas"],
    rows: [
      ["Licenciatura", "Chihuahua; Hermosillo", "Porcentaje adicional", "Cualquier ingreso", "Presencial", "Toda la carrera", "20", "Activo", "Ejemplo por planteles"],
      ["Todas", "Todos", "Porcentaje adicional", "Nuevo ingreso", "Todas", "Cualquiera", "15", "Activo", "Ejemplo global"],
    ],
    notes: [
      "linea_negocio, tipo_ingreso, modalidad y duracion aceptan etiquetas de UI o valores canónicos.",
      "planteles acepta uno o varios nombres separados por punto y coma; usa Todos para alcance global.",
      "porcentaje_adicional debe ser numérico, sin símbolo %.",
      "estado acepta Activo/Inactivo, true/false, si/no, 1/0.",
    ],
  },
  {
    id: "base-scholarships",
    label: "Becas base",
    description: "Carga porcentajes base por promedio, línea de negocio, modalidad e ingreso.",
    moduleLabel: "Beneficios",
    format: "csv",
    fileName: "plantilla-becas-base.csv",
    headers: ["tipo_ingreso", "linea", "modalidad", "plan", "region", "plantel", "programa", "tier", "promedio_min", "promedio_max", "porcentaje_beca", "notas"],
    rows: [
      ["Nuevo ingreso", "licenciatura", "presencial", "11", "General", "Todos", "", "T1", "8.0", "8.9", "20", "Ejemplo general"],
      ["Nuevo ingreso", "licenciatura", "online", "11", "Online", "Online", "", "", "9.0", "10", "35", "Online usa tier ANY"],
    ],
    notes: [
      "tipo_ingreso, linea, modalidad, plantel, programa y tier usan el mismo normalizador global que la captura manual.",
      "plan es obligatorio y debe ser entero mayor que 0.",
      "promedio_min/promedio_max pueden sustituirse por una columna promedio con formato 8-8.9.",
      "porcentaje_beca debe ser numérico, sin símbolo %.",
    ],
  },
  {
    id: "aliases",
    label: "Aliases canónicos",
    description: "Carga equivalencias para normalizar valores de importadores.",
    moduleLabel: "Catálogos",
    format: "csv",
    fileName: "plantilla-aliases.csv",
    headers: ["tipo", "valor_canonico", "alias", "activo", "notas"],
    rows: [
      ["modalidad", "presencial", "escolarizada", "true", "Ejemplo"],
      ["nivel", "licenciatura", "lic", "true", "Ejemplo"],
      ["programa", "Administracion de Empresas", "LAE", "true", "Ejemplo"],
    ],
    notes: [
      "tipo debe coincidir con los tipos soportados por la pantalla de aliases.",
      "valor_canonico es el valor final que usará el sistema.",
    ],
  },
  {
    id: "academic-offer",
    label: "Oferta por planteles",
    description: "Plantilla CSV compatible con el importador de oferta por planteles.",
    moduleLabel: "Oferta académica",
    format: "csv",
    fileName: "plantilla-oferta-por-planteles.csv",
    headers: [
      "Ciclo",
      "Plantel",
      "Programa",
      "Línea",
      "Modalidad",
      "Plan",
      "Modulo",
      "No. de modulos",
      "Materias por módulo",
      "Horario escolarizado",
      "Horario ejecutivo",
      "Estado",
    ],
    rows: [
      ["C1", "Hermosillo", "Administracion de Empresas", "licenciatura", "presencial", "9", "Modular M1, M2, M3", "3", "9=(M1=2,M2=2,M3=1)", "L-V 08:00-13:00", "", "Activo"],
      ["C1", "Los Cabos", "Derecho", "licenciatura", "mixta", "9, 11", "Modular M1, M2", "2", "9=(M1=2,M2=2);11=(M1=1,M2=2)", "L-V 08:00-13:00", "Sáb 09:00-14:00", "Activo"],
      ["C1", "Online", "Psicologia", "licenciatura", "online", "9", "Longitudinal", "1", "", "", "", "Activo"],
    ],
    notes: [
      "El CSV se convierte automáticamente al formato XLSX interno antes de validar.",
      "Estado acepta Activo/Inactivo, true/false, si/no, 1/0; filas inactivas no se importan.",
      "Modalidad acepta presencial, escolarizado, ejecutivo, mixta u online. Para mixta puedes llenar ambos horarios.",
      "Materias por módulo acepta texto estructurado, por ejemplo 9=(M1=2,M2=2,M3=1);11=(M1=1,M2=2,M3=1).",
    ],
  },
  {
    id: "academic-fees",
    label: "Costos académicos",
    description: "Carga costos base de trámites y disponibilidad/costo por plantel en un solo archivo.",
    moduleLabel: "Costos académicos",
    format: "csv",
    fileName: "plantilla-costos-academicos.csv",
    headers: [
      "codigo",
      "concepto",
      "seccion",
      "costo_base",
      "plantel",
      "costo_plantel",
      "activo_plantel",
      "notas",
    ],
    rows: [
      ["CONST_EST", "Constancia de estudios", "TRAMITES", "120", "Hermosillo", "", "true", "Costo base disponible para plantel"],
      ["EX_ORD", "Examen ordinario", "EXAMENES", "350", "Todos", "", "true", "Usa un plantel por fila; Todos documenta alcance global"],
      ["MAT_DUP", "Duplicado de credencial", "DIVERSOS", "90", "Nogales", "100", "true", "Override por plantel"],
    ],
    notes: [
      "seccion acepta EXAMENES, TRAMITES o DIVERSOS, con o sin acentos.",
      "costo_base y costo_plantel deben ser numéricos, sin símbolo de moneda.",
      "plantel acepta nombre, código o alias configurado; usa una fila por plantel.",
      "activo_plantel acepta Activo/Inactivo, true/false, si/no, 1/0.",
    ],
  },
] satisfies AdminImportTemplate[];

export function getAdminImportTemplate(id: string) {
  return ADMIN_IMPORT_TEMPLATES.find((template) => template.id === id) ?? null;
}
