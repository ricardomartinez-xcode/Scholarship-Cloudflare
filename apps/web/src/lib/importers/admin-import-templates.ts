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
    headers: ["region", "plantel", "programa", "nivel", "modalidad", "plan", "tier", "precio", "activo", "notas"],
    rows: [
      ["Nacional", "", "Administracion de Empresas", "licenciatura", "presencial", "2024", "A", "3500", "true", "Ejemplo nacional"],
      ["Sonora", "Hermosillo", "Psicologia", "licenciatura", "online", "2024", "B", "2800", "true", "Ejemplo por plantel"],
    ],
    notes: [
      "Usa aliases configurables para programa, nivel y modalidad cuando existan.",
      "activo acepta true/false, si/no, 1/0.",
      "precio debe ser numérico, sin símbolo de moneda.",
    ],
  },
  {
    id: "benefits",
    label: "Beneficios",
    description: "Carga reglas de beneficios por línea, modalidad, inscripción y rango académico.",
    moduleLabel: "Beneficios",
    format: "csv",
    fileName: "plantilla-beneficios.csv",
    headers: ["linea", "modalidad", "tipo_ingreso", "promedio_min", "promedio_max", "beneficio", "activo", "notas"],
    rows: [
      ["licenciatura", "presencial", "nuevo ingreso", "8.0", "8.9", "20", "true", "Ejemplo"],
      ["maestria", "online", "reingreso", "9.0", "10", "30", "true", "Ejemplo"],
    ],
    notes: [
      "linea, modalidad y tipo_ingreso aceptan aliases configurables.",
      "promedio_min/promedio_max deben ser numéricos.",
      "beneficio representa porcentaje o valor según la regla vigente del importador.",
    ],
  },
  {
    id: "base-scholarships",
    label: "Becas base",
    description: "Carga porcentajes base por promedio, línea de negocio, modalidad e ingreso.",
    moduleLabel: "Beneficios",
    format: "csv",
    fileName: "plantilla-becas-base.csv",
    headers: ["tipo_ingreso", "linea", "modalidad", "promedio_min", "promedio_max", "porcentaje_beca", "activo", "notas"],
    rows: [
      ["nuevo ingreso", "licenciatura", "presencial", "8.0", "8.9", "20", "true", "Ejemplo"],
      ["nuevo ingreso", "licenciatura", "online", "9.0", "10", "35", "true", "Ejemplo"],
    ],
    notes: [
      "tipo_ingreso, linea y modalidad usan el catálogo canónico más aliases configurables.",
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
      "ciclo",
      "plantel",
      "programa",
      "linea",
      "modalidad",
      "plan",
      "horario",
      "horario_escolarizado",
      "horario_ejecutivo",
      "activo",
      "notas",
    ],
    rows: [
      ["C1", "Hermosillo", "Administracion de Empresas", "licenciatura", "presencial", "9", "L-V 08:00-13:00", "", "", "true", "Ejemplo presencial"],
      ["C1", "Los Cabos", "Derecho", "licenciatura", "mixta", "9", "", "L-V 08:00-13:00", "Sáb 09:00-14:00", "true", "Ejemplo con ambos horarios"],
      ["C1", "Online", "Psicologia", "licenciatura", "online", "9", "Online asincrónico", "", "", "true", "Ejemplo online"],
    ],
    notes: [
      "El CSV se convierte automáticamente al formato XLSX interno antes de validar.",
      "activo acepta true/false, si/no, 1/0; filas inactivas no se importan.",
      "horario se aplica a la modalidad detectada; usa horario_escolarizado y horario_ejecutivo cuando un programa tenga ambas.",
    ],
  },
] satisfies AdminImportTemplate[];

export function getAdminImportTemplate(id: string) {
  return ADMIN_IMPORT_TEMPLATES.find((template) => template.id === id) ?? null;
}
