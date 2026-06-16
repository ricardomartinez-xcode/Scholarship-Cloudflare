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
    headers: ["region", "plantel", "programa", "nivel", "modalidad", "plan", "modulo", "tier", "precio", "precio_por_materia", "activo", "notas"],
    rows: [
      ["Nacional", "", "Administracion de Empresas", "licenciatura", "presencial", "2024", "M1", "A", "3500", "", "true", "Ejemplo nacional"],
      ["Sonora", "Hermosillo", "Psicologia", "licenciatura", "online", "2024", "Longitudinal", "B", "2800", "750", "true", "Ejemplo por plantel"],
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
] satisfies AdminImportTemplate[];

export function getAdminImportTemplate(id: string) {
  return ADMIN_IMPORT_TEMPLATES.find((template) => template.id === id) ?? null;
}
