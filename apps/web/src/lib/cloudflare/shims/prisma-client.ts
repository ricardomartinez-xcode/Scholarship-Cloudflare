class PrismaRuntimeError extends Error {
  code?: string;
  clientVersion?: string;

  constructor(message: string, options?: { code?: string; clientVersion?: string }) {
    super(message);
    this.name = "PrismaRuntimeError";
    this.code = options?.code;
    this.clientVersion = options?.clientVersion;
  }
}

class DecimalShim {
  private readonly value: string;

  constructor(value: string | number | bigint | DecimalShim) {
    this.value = value instanceof DecimalShim ? value.value : String(value);
  }

  toNumber() {
    return Number(this.value);
  }

  toString() {
    return this.value;
  }

  toJSON() {
    return this.value;
  }

  valueOf() {
    return Number(this.value);
  }
}

function taggedSql(strings: TemplateStringsArray | string[], ...values: unknown[]) {
  return { strings: Array.from(strings), values };
}

function createPrismaClientProxy(): unknown {
  const fail = () => {
    throw new PrismaRuntimeError(
      "Prisma is disabled in the Cloudflare Worker runtime. Use the D1 data layer instead.",
    );
  };

  const modelProxy = new Proxy(
    {},
    {
      get() {
        return fail;
      },
    },
  );

  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "$disconnect") return async () => undefined;
        if (property === "$connect") return async () => undefined;
        if (property === "$transaction") {
          return async (callbackOrQueries: unknown) => {
            if (typeof callbackOrQueries === "function") {
              return (callbackOrQueries as (client: unknown) => unknown)(modelProxy);
            }
            fail();
          };
        }
        if (property === "$queryRaw" || property === "$executeRaw") return fail;
        if (property === "$queryRawUnsafe" || property === "$executeRawUnsafe") return fail;
        return modelProxy;
      },
    },
  );
}

export class PrismaClient {
  constructor() {
    return createPrismaClientProxy() as PrismaClient;
  }
}

export const Prisma = {
  JsonNull: null,
  DbNull: null,
  AnyNull: null,
  empty: "",
  join(values: unknown[]) {
    return values;
  },
  raw(value: unknown) {
    return value;
  },
  sql: taggedSql,
  Decimal: DecimalShim,
  PrismaClientKnownRequestError: PrismaRuntimeError,
};

export const Decimal = DecimalShim;
export const AdminPublicCtaKind = { link: "link", action: "action" } as const;
export const AdminAnnouncementDisplay = { banner: "banner", popout: "popout" } as const;
export const AdminPublicCtaLocation = {
  HOME_PRIMARY: "HOME_PRIMARY",
  HOME_PRIMARY_INSIDE: "HOME_PRIMARY_INSIDE",
  HOME_SECONDARY: "HOME_SECONDARY",
  APP_RESULTS_BELOW: "APP_RESULTS_BELOW",
  APP_RESULTS_ABOVE: "APP_RESULTS_ABOVE",
  APP_RESULTS_INSIDE: "APP_RESULTS_INSIDE",
  UNIDEP_PRIMARY: "UNIDEP_PRIMARY",
  CALCULATOR_FOOTER: "CALCULATOR_FOOTER",
  NAV_BANNER: "NAV_BANNER",
  SIDEBAR_TOP: "SIDEBAR_TOP",
  SIDEBAR_BOTTOM: "SIDEBAR_BOTTOM",
  SIMULATOR_TOP: "SIMULATOR_TOP",
  SIMULATOR_BOTTOM: "SIMULATOR_BOTTOM",
  AUTH_WELCOME: "AUTH_WELCOME",
  AUTH_WELCOME_INSIDE: "AUTH_WELCOME_INSIDE",
  ADMIN_HEADER_BANNER: "ADMIN_HEADER_BANNER",
  ADMIN_SIDEBAR_TOP: "ADMIN_SIDEBAR_TOP",
  ADMIN_SIDEBAR_BOTTOM: "ADMIN_SIDEBAR_BOTTOM",
  ADMIN_CONTENT_TOP: "ADMIN_CONTENT_TOP",
  ADMIN_CONTENT_INSIDE: "ADMIN_CONTENT_INSIDE",
} as const;
export const AdminConfigModule = {
  ACCESS: "ACCESS",
  BENEFITS: "BENEFITS",
  PRICES: "PRICES",
  CTAS: "CTAS",
  SIDEBAR: "SIDEBAR",
  DIRECTORY: "DIRECTORY",
  OFFER: "OFFER",
} as const;
export const AdminCapability = {
  view_admin: "view_admin",
  manage_benefits: "manage_benefits",
  manage_prices: "manage_prices",
  manage_ctas: "manage_ctas",
  manage_sidebar: "manage_sidebar",
  manage_offers: "manage_offers",
  manage_directory: "manage_directory",
  view_users: "view_users",
  manage_users: "manage_users",
  view_invites: "view_invites",
  manage_invites: "manage_invites",
  view_org_members: "view_org_members",
  manage_org_members: "manage_org_members",
  view_reports: "view_reports",
  view_admin_operations: "view_admin_operations",
  publish_config: "publish_config",
} as const;
export const UserCapability = {
  access_admin_cta: "access_admin_cta",
  user_vip: "user_vip",
  view_audit: "view_audit",
  manage_templates: "manage_templates",
  manage_communications: "manage_communications",
  owner_permissions: "owner_permissions",
} as const;
export const UserAgendaItemType = {
  recordatorio: "recordatorio",
  pago: "pago",
  pendiente: "pendiente",
} as const;
export const UserAgendaItemStatus = {
  abierto: "abierto",
  hecho: "hecho",
  cancelado: "cancelado",
} as const;
export const AdminUiModule = {
  ADMIN_HOME: "ADMIN_HOME",
  USERS: "USERS",
  INVITATIONS: "INVITATIONS",
  ORGANIZATIONS: "ORGANIZATIONS",
  AUDIT: "AUDIT",
  BENEFITS: "BENEFITS",
  PRICES: "PRICES",
  CTAS: "CTAS",
  SIDEBAR: "SIDEBAR",
  OFFER: "OFFER",
  DIRECTORY: "DIRECTORY",
  CAMPUSES: "CAMPUSES",
  FEES: "FEES",
  PROGRAMS: "PROGRAMS",
} as const;
export const WhatsappTemplateStatus = {
  personal: "personal",
  submitted_for_review: "submitted_for_review",
  approved: "approved",
  rejected: "rejected",
  official: "official",
  archived: "archived",
} as const;
export const WhatsappTemplateKind = { summary: "summary", detailed: "detailed" } as const;
export const AdminAuditAction = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  PUBLISH: "PUBLISH",
  ROLLBACK: "ROLLBACK",
  IMPORT_VALIDATE: "IMPORT_VALIDATE",
  IMPORT_APPLY: "IMPORT_APPLY",
  IMPORT_ROLLBACK: "IMPORT_ROLLBACK",
} as const;
export const AdminChangeSource = { UI: "UI", IMPORT: "IMPORT", SYSTEM: "SYSTEM" } as const;
export const AdminImportSessionStatus = {
  preview: "preview",
  applied: "applied",
  rolled_back: "rolled_back",
  failed: "failed",
} as const;
export const CampusKind = { campus: "campus", online: "online" } as const;
export const ProgramOfferingDelivery = { CAMPUS: "CAMPUS", ONLINE: "ONLINE" } as const;
export const BenefitBusinessLine = {
  salud: "salud",
  licenciatura: "licenciatura",
  prepa: "prepa",
  posgrado: "posgrado",
} as const;
export const AcademicFeeSection = {
  EXAMENES: "EXAMENES",
  TRAMITES: "TRAMITES",
  DIVERSOS: "DIVERSOS",
} as const;
export const BenefitModality = {
  presencial: "presencial",
  mixta: "mixta",
  online: "online",
} as const;
export const BenefitDuration = {
  primer_cuatrimestre: "primer_cuatrimestre",
  toda_la_carrera: "toda_la_carrera",
  pago_inicial: "pago_inicial",
} as const;
export const AdminPlacementPage = {
  public_home: "public_home",
  app_unidep: "app_unidep",
  admin: "admin",
  auth: "auth",
} as const;
export const AdminPlacementSection = {
  navigation: "navigation",
  hero: "hero",
  welcome: "welcome",
  results: "results",
  simulator: "simulator",
  sidebar: "sidebar",
  content: "content",
  module: "module",
} as const;
export const AdminPlacementPanel = {
  banner: "banner",
  primary: "primary",
  secondary: "secondary",
  results: "results",
  sidebar: "sidebar",
  header: "header",
  content: "content",
} as const;
export const AdminPlacementSlot = {
  top: "top",
  inside: "inside",
  bottom: "bottom",
  primary: "primary",
  secondary: "secondary",
  footer: "footer",
  actions: "actions",
} as const;
export const AdminPlacementBreakpoint = {
  all: "all",
  mobile: "mobile",
  desktop: "desktop",
} as const;
export const AdminAdditionalBenefitType = {
  percentage: "percentage",
  first_payment: "first_payment",
  fixed_scholarship: "fixed_scholarship",
} as const;
export const EnrollmentType = {
  nuevo_ingreso: "nuevo_ingreso",
  regreso: "regreso",
  reingreso: "reingreso",
} as const;
export const CanonicalModality = {
  presencial: "presencial",
  mixta: "mixta",
  online: "online",
} as const;
export const QuoteScenarioKind = { DRAFT: "DRAFT", SAVED: "SAVED" } as const;
export const BusinessEventType = {
  QUOTE_GENERATED: "QUOTE_GENERATED",
  QUOTE_SIMULATED: "QUOTE_SIMULATED",
  QUOTE_SCENARIO_SAVED: "QUOTE_SCENARIO_SAVED",
  QUOTE_SCENARIO_LOADED: "QUOTE_SCENARIO_LOADED",
  QUOTE_COMPARISON_VIEWED: "QUOTE_COMPARISON_VIEWED",
  CTA_CLICKED: "CTA_CLICKED",
  BENEFIT_APPLIED: "BENEFIT_APPLIED",
  INVITE_CREATED: "INVITE_CREATED",
  INVITE_RESENT: "INVITE_RESENT",
  OFFER_PUBLISHED: "OFFER_PUBLISHED",
  IMPORT_VALIDATED: "IMPORT_VALIDATED",
  IMPORT_APPLIED: "IMPORT_APPLIED",
  IMPORT_ROLLED_BACK: "IMPORT_ROLLED_BACK",
  IMPORT_FAILED: "IMPORT_FAILED",
  EXTENSION_TOKEN_ISSUED: "EXTENSION_TOKEN_ISSUED",
  EXTENSION_RUN_CREATED: "EXTENSION_RUN_CREATED",
  EXTENSION_RUN_EVENT: "EXTENSION_RUN_EVENT",
  WHATSAPP_WEB_OPENED: "WHATSAPP_WEB_OPENED",
} as const;
export const ProgramAssetType = {
  PLAN_PDF: "PLAN_PDF",
  BROCHURE_PDF: "BROCHURE_PDF",
  PLAN_URL: "PLAN_URL",
  PLAN_DRIVE_LINK: "PLAN_DRIVE_LINK",
} as const;
export const ProgramAssetStatus = {
  healthy: "healthy",
  broken: "broken",
  timeout: "timeout",
  unauthorized: "unauthorized",
  skipped: "skipped",
} as const;
export const DirectoryContactMethodType = {
  EMAIL: "EMAIL",
  PHONE: "PHONE",
  WHATSAPP: "WHATSAPP",
  URL: "URL",
  OTHER: "OTHER",
} as const;
export const Role = {
  owner: "owner",
  admin_operativo: "admin_operativo",
  editor_operativo: "editor_operativo",
  user: "user",
} as const;
export const OrgRole = { owner: "owner", admin: "admin", member: "member" } as const;
export const TrainingAccessRole = {
  user: "user",
  moderator: "moderator",
  admin: "admin",
  owner: "owner",
} as const;
export const TrainingChatStatus = {
  open: "open",
  closed: "closed",
  archived: "archived",
} as const;
export const InboxThreadStatus = { active: "active", archived: "archived" } as const;
export const TrainingRoomVisibility = {
  private: "private",
  org: "org",
  public: "public",
} as const;
export const TrainingRoomRole = {
  participant: "participant",
  trainer: "trainer",
  facilitator: "facilitator",
} as const;
