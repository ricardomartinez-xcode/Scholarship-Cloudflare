export const flowOptions = {
  lineas: ["Licenciatura", "Maestría", "Doctorado"],
  modalidades: ["Presencial", "Ejecutiva", "Online"],
  planteles: ["Centro", "Norte", "Sur", "Virtual"],
  planes: ["Administración", "Derecho", "Psicología", "TI"],
  modulos: [
    "Módulo 1 (carga completa)",
    "Módulo 2 (3 materias)",
    "Módulo 3 (1 materia)",
  ],
};

export const ajustesAcademicos = {
  convenios: [
    "Convenio Empresa X",
    "Convenio Comunidad",
    "Convenio Exalumnos",
    "Convenio Gobierno",
  ],
  extraordinarios: [
    "Extraordinario 1",
    "Extraordinario 2",
    "Extraordinario 3",
    "Extraordinario 4",
  ],
  tramites: [
    "Inscripción",
    "Credencial",
    "Kardex",
    "Revalidación",
  ],
};

export const programasPorPlantel = [
  {
    plantel: "Centro",
    programas: [
      {
        nombre: "Administración",
        modalidad: "Ejecutiva",
        horario: "Sábados 9:00 - 13:00",
        planUrl: "#",
      },
      {
        nombre: "Derecho",
        modalidad: "Presencial",
        horario: "L-V 18:00 - 21:00",
        planUrl: "#",
      },
    ],
  },
  {
    plantel: "Norte",
    programas: [
      {
        nombre: "Psicología",
        modalidad: "Online",
        horario: "Flexible",
        planUrl: "#",
      },
    ],
  },
];

export const recursosDock = [
  { key: "becas", label: "Becas", icon: "🎓" },
  { key: "oferta", label: "Oferta académica", icon: "📚" },
  { key: "costos", label: "Costos académicos", icon: "💳" },
  { key: "planes", label: "Planes de estudio", icon: "🧭" },
  { key: "directorio", label: "Directorio", icon: "👥" },
  { key: "planteles", label: "Planteles", icon: "📍" },
];
