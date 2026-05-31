export const CTA_LOCATIONS = [
  {
    value: "HOME_PRIMARY",
    label: "Inicio público — tarjeta principal (pre-login)",
    description: "Se muestra dentro de la tarjeta principal de la página de inicio (antes de iniciar sesión).",
  },
  {
    value: "HOME_PRIMARY_INSIDE",
    label: "Inicio público — dentro del panel principal",
    description: "Se muestra dentro del panel principal del home público, entre la bienvenida y las acciones de acceso.",
  },
  {
    value: "HOME_SECONDARY",
    label: "Inicio público — columna lateral / apoyo",
    description: "Se muestra en la columna lateral del inicio público para apoyo, contacto o acciones secundarias.",
  },
  {
    value: "APP_RESULTS_BELOW",
    label: "Cotizador — debajo del resultado",
    description: "Se muestra debajo del resultado de la calculadora. No aparece en el header/hero.",
  },
  {
    value: "APP_RESULTS_ABOVE",
    label: "Cotizador — arriba del resultado",
    description: "Se muestra dentro del cotizador, antes del panel de resultado. No aparece en el header/hero.",
  },
  {
    value: "APP_RESULTS_INSIDE",
    label: "Cotizador — acciones internas",
    description: "Se muestra dentro de las acciones del cotizador.",
  },
  {
    value: "UNIDEP_PRIMARY",
    label: "App autenticada — header/hero principal",
    description: "Se muestra dentro del header/hero de la app autenticada, arriba del contenido y fuera del cotizador.",
  },
  {
    value: "CALCULATOR_FOOTER",
    label: "App UNIDEP — pie de la calculadora",
    description: "Se muestra al pie de la calculadora de becas. Usa url=#refresh-data para replicar el botón 'Recargar datos'.",
  },
  {
    value: "NAV_BANNER",
    label: "Banner de navegación (global)",
    description: "Barra superior visible en todas las páginas (inicio público y app autenticada).",
  },
  {
    value: "SIDEBAR_TOP",
    label: "App UNIDEP — sidebar superior",
    description: "Se muestra en la parte superior del menú lateral de la app autenticada.",
  },
  {
    value: "SIDEBAR_BOTTOM",
    label: "App UNIDEP — columna lateral inferior",
    description: "Se muestra en la parte inferior de la columna lateral de la app autenticada.",
  },
  {
    value: "SIMULATOR_TOP",
    label: "App UNIDEP — simulador (parte superior)",
    description: "Se muestra dentro del panel Simulador, arriba del historial y las acciones de escenarios en el sidebar de /unidep.",
  },
  {
    value: "SIMULATOR_BOTTOM",
    label: "App UNIDEP — simulador (parte inferior)",
    description: "Se muestra dentro del panel Simulador, debajo de las acciones y comparaciones del sidebar de /unidep.",
  },
  {
    value: "AUTH_WELCOME",
    label: "App autenticada — header/hero post-login",
    description: "Se combina con el header/hero de la app autenticada tras iniciar sesión.",
  },
  {
    value: "AUTH_WELCOME_INSIDE",
    label: "App autenticada — acciones del header post-login",
    description: "Se combina con las acciones del header/hero de la app autenticada.",
  },
  {
    value: "ADMIN_HEADER_BANNER",
    label: "Admin — banner superior",
    description: "Se muestra debajo del header del admin y encima del contenido principal.",
  },
  {
    value: "ADMIN_SIDEBAR_TOP",
    label: "Admin — columna lateral superior",
    description: "Se muestra en la columna lateral del admin, antes de la navegación principal.",
  },
  {
    value: "ADMIN_SIDEBAR_BOTTOM",
    label: "Admin — columna lateral inferior",
    description: "Se muestra al final de la columna lateral del admin, debajo de la navegación.",
  },
  {
    value: "ADMIN_CONTENT_TOP",
    label: "Admin — acciones del módulo",
    description: "Se muestra encima del contenido del módulo actual, útil para accesos directos internos.",
  },
  {
    value: "ADMIN_CONTENT_INSIDE",
    label: "Admin — dentro del panel de contenido",
    description: "Se muestra dentro del área principal del módulo, entre el header de acciones y el contenido.",
  },
] as const;

export type CtaLocation = (typeof CTA_LOCATIONS)[number]["value"];

export const CTA_LOCATION_META = {
  HOME_PRIMARY: {
    pageKey: "public",
    pageLabel: "Inicio público",
    sectionLabel: "Hero principal",
    slotLabel: "Tarjeta principal",
    shortLabel: "Hero principal",
  },
  HOME_PRIMARY_INSIDE: {
    pageKey: "public",
    pageLabel: "Inicio público",
    sectionLabel: "Hero principal",
    slotLabel: "Dentro del hero",
    shortLabel: "Dentro del hero",
  },
  HOME_SECONDARY: {
    pageKey: "public",
    pageLabel: "Inicio público",
    sectionLabel: "Columna lateral",
    slotLabel: "Rail secundario",
    shortLabel: "Rail lateral",
  },
  NAV_BANNER: {
    pageKey: "public",
    pageLabel: "Navegación global",
    sectionLabel: "Banner superior",
    slotLabel: "Franja global",
    shortLabel: "Banner global",
  },
  APP_RESULTS_ABOVE: {
    pageKey: "app",
    pageLabel: "App UNIDEP",
    sectionLabel: "Cotizador",
    slotLabel: "Arriba del resultado",
    shortLabel: "Arriba del resultado",
  },
  APP_RESULTS_INSIDE: {
    pageKey: "app",
    pageLabel: "App UNIDEP",
    sectionLabel: "Cotizador",
    slotLabel: "Acciones internas",
    shortLabel: "Acciones internas",
  },
  APP_RESULTS_BELOW: {
    pageKey: "app",
    pageLabel: "App UNIDEP",
    sectionLabel: "Cotizador",
    slotLabel: "Después del resultado",
    shortLabel: "Después del resultado",
  },
  UNIDEP_PRIMARY: {
    pageKey: "app",
    pageLabel: "App UNIDEP",
    sectionLabel: "Header / hero",
    slotLabel: "Acciones principales",
    shortLabel: "Header / hero",
  },
  CALCULATOR_FOOTER: {
    pageKey: "app",
    pageLabel: "App UNIDEP",
    sectionLabel: "Calculadora",
    slotLabel: "Pie de calculadora",
    shortLabel: "Pie calculadora",
  },
  SIDEBAR_TOP: {
    pageKey: "app",
    pageLabel: "App UNIDEP",
    sectionLabel: "Columna lateral",
    slotLabel: "Superior",
    shortLabel: "Sidebar superior",
  },
  SIDEBAR_BOTTOM: {
    pageKey: "app",
    pageLabel: "App UNIDEP",
    sectionLabel: "Columna lateral",
    slotLabel: "Inferior",
    shortLabel: "Rail inferior",
  },
  SIMULATOR_TOP: {
    pageKey: "app",
    pageLabel: "App UNIDEP",
    sectionLabel: "Simulador",
    slotLabel: "Parte superior",
    shortLabel: "Simulador superior",
  },
  SIMULATOR_BOTTOM: {
    pageKey: "app",
    pageLabel: "App UNIDEP",
    sectionLabel: "Simulador",
    slotLabel: "Parte inferior",
    shortLabel: "Simulador inferior",
  },
  AUTH_WELCOME: {
    pageKey: "app",
    pageLabel: "App UNIDEP",
    sectionLabel: "Header / hero",
    slotLabel: "Post-login",
    shortLabel: "Header post-login",
  },
  AUTH_WELCOME_INSIDE: {
    pageKey: "app",
    pageLabel: "App UNIDEP",
    sectionLabel: "Header / hero",
    slotLabel: "Acciones post-login",
    shortLabel: "Acciones post-login",
  },
  ADMIN_HEADER_BANNER: {
    pageKey: "admin",
    pageLabel: "Admin",
    sectionLabel: "Encabezado",
    slotLabel: "Banner superior",
    shortLabel: "Banner superior",
  },
  ADMIN_SIDEBAR_TOP: {
    pageKey: "admin",
    pageLabel: "Admin",
    sectionLabel: "Columna lateral",
    slotLabel: "Superior",
    shortLabel: "Rail superior",
  },
  ADMIN_SIDEBAR_BOTTOM: {
    pageKey: "admin",
    pageLabel: "Admin",
    sectionLabel: "Columna lateral",
    slotLabel: "Inferior",
    shortLabel: "Rail inferior",
  },
  ADMIN_CONTENT_TOP: {
    pageKey: "admin",
    pageLabel: "Admin",
    sectionLabel: "Módulo activo",
    slotLabel: "Antes del contenido",
    shortLabel: "Antes del módulo",
  },
  ADMIN_CONTENT_INSIDE: {
    pageKey: "admin",
    pageLabel: "Admin",
    sectionLabel: "Módulo activo",
    slotLabel: "Dentro del contenido",
    shortLabel: "Dentro del módulo",
  },
} as const satisfies Record<
  CtaLocation,
  {
    pageKey: "public" | "app" | "admin";
    pageLabel: string;
    sectionLabel: string;
    slotLabel: string;
    shortLabel: string;
  }
>;

export function isCtaLocation(value: string): value is CtaLocation {
  return CTA_LOCATIONS.some((x) => x.value === value);
}

export const SIDEBAR_FIELDS = [
  {
    key: "CONTACT_PHONE",
    label: "Teléfono de contacto",
    description: "Se muestra en la columna lateral de contacto del inicio público.",
    inputType: "phone" as const,
    sortOrder: 10,
  },
  {
    key: "CONTACT_EMAIL",
    label: "Correo de contacto",
    description: "Se muestra en la columna lateral de contacto del inicio público.",
    inputType: "email" as const,
    sortOrder: 20,
  },
  {
    key: "CONTACT_WHATSAPP",
    label: "WhatsApp",
    description: "Se muestra en la columna lateral de contacto del inicio público.",
    inputType: "phone" as const,
    sortOrder: 30,
  },
  {
    key: "ADDRESS_MAIN",
    label: "Dirección principal",
    description: "Se muestra en la columna lateral de contacto del inicio público.",
    inputType: "textarea" as const,
    sortOrder: 40,
  },
  {
    key: "HOURS_WEEKDAYS",
    label: "Horario (L-V)",
    description: "Se muestra en la columna lateral de contacto del inicio público.",
    inputType: "text" as const,
    sortOrder: 50,
  },
  {
    key: "HOURS_WEEKENDS",
    label: "Horario (S-D)",
    description: "Se muestra en la columna lateral de contacto del inicio público.",
    inputType: "text" as const,
    sortOrder: 60,
  },
  {
    key: "WEBSITE_URL",
    label: "Sitio web",
    description: "Se muestra en la columna lateral de contacto del inicio público.",
    inputType: "url" as const,
    sortOrder: 70,
  },
] as const;

export type SidebarFieldKey = (typeof SIDEBAR_FIELDS)[number]["key"];

export function isSidebarFieldKey(value: string): value is SidebarFieldKey {
  return SIDEBAR_FIELDS.some((f) => f.key === value);
}
