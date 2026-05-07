/**
 * Admin Permission Enforcement Matrix
 *
 * Central source of truth mapping each AdminCapability to:
 *   - module: human-readable module name
 *   - routes: frontend routes this capability protects
 *   - uiActions: UI-level actions/CTAs enabled by this capability
 *   - mutations: server-side mutations gated by this capability
 *
 * This matrix is **documentation + contract**.  Page guards
 * (requireAdminCapabilityUser) and nav gating (AdminChrome) must stay
 * aligned with the entries below.  When you add a new route or action,
 * update this file first so the contract remains obvious.
 *
 * Usage:
 *   import { ADMIN_PERMISSION_MATRIX, ADMIN_ROUTE_GUARDS } from "@/lib/admin-permission-matrix";
 *   // check what a capability controls:
 *   ADMIN_PERMISSION_MATRIX[AdminCapability.manage_benefits].routes
 *   // check what guard a route requires:
 *   ADMIN_ROUTE_GUARDS["/admin/benefits"]
 */

import { AdminCapability } from "@prisma/client";

export type AdminPermissionEntry = {
  /** Human-readable name of the module or functional area */
  module: string;
  /** Frontend routes whose page guards require this capability */
  routes: string[];
  /** UI actions / CTAs that become visible with this capability */
  uiActions: string[];
  /** Server-side mutation names gated by this capability */
  mutations: string[];
};

/**
 * Capability → pages / actions / mutations map.
 * Keep in sync with page-level requireAdminCapabilityUser() calls.
 */
export const ADMIN_PERMISSION_MATRIX: Record<
  AdminCapability,
  AdminPermissionEntry
> = {
  [AdminCapability.view_admin]: {
    module: "Panel de administración",
    routes: ["/admin"],
    uiActions: ["navigate_admin_panel"],
    mutations: [],
  },

  [AdminCapability.manage_benefits]: {
    module: "Beneficios adicionales",
    routes: ["/admin/benefits"],
    uiActions: [
      "create_benefit",
      "update_benefit",
      "toggle_benefit",
      "delete_benefit",
    ],
    mutations: ["upsertAdminBenefit", "deleteAdminBenefit"],
  },

  [AdminCapability.manage_prices]: {
    module: "Precios y costos académicos",
    // NOTE: /admin/prices currently calls getAdminUser() without a
    // capability check — see TODO in prices/page.tsx.
    routes: ["/admin/prices", "/admin/unidep/fees"],
    uiActions: [
      "create_price_override",
      "update_price_override",
      "delete_price_override",
    ],
    mutations: ["upsertMontoOverride", "deletePriceOverride"],
  },

  [AdminCapability.manage_ctas]: {
    module: "CTAs, comunicados, templates y canal WhatsApp",
    routes: [
      "/admin/ctas",
      "/admin/comunicados",
      "/admin/whatsapp-templates",
      "/admin/whatsapp",
    ],
    uiActions: [
      "create_cta",
      "update_cta",
      "delete_cta",
      "create_comunicado",
      "manage_whatsapp_template",
      "manage_whatsapp_console",
    ],
    mutations: [
      "upsertCta",
      "deleteCta",
      "upsertAnuncio",
      "upsertWhatsappTemplate",
    ],
  },

  [AdminCapability.manage_sidebar]: {
    module: "Mensajes de sidebar",
    routes: ["/admin/sidebar"],
    uiActions: [
      "create_sidebar_entry",
      "update_sidebar_entry",
      "delete_sidebar_entry",
    ],
    mutations: ["upsertSidebarInfo", "deleteSidebarInfo"],
  },

  [AdminCapability.manage_offers]: {
    module: "Oferta académica",
    routes: ["/admin/oferta", "/admin/unidep/programs", "/admin/unidep/formatos"],
    uiActions: ["import_offer", "manage_programs", "manage_enrollment_formats"],
    mutations: ["importOffer", "upsertProgram", "upsertEnrollmentFormat"],
  },

  [AdminCapability.manage_directory]: {
    module: "Directorio y planteles",
    routes: ["/admin/unidep/directory", "/admin/unidep/campuses"],
    uiActions: ["manage_directory_entry", "manage_campus"],
    mutations: ["upsertDirectoryEntry", "upsertCampus"],
  },

  [AdminCapability.view_users]: {
    module: "Consultar usuarios",
    routes: ["/admin/users"],
    uiActions: ["view_user_detail", "view_user_capabilities"],
    mutations: [],
  },

  [AdminCapability.manage_users]: {
    module: "Gestionar usuarios",
    routes: ["/admin/users"],
    uiActions: [
      "activate_user",
      "deactivate_user",
      "update_user_capabilities",
    ],
    mutations: ["setUserActive", "upsertCapabilityOverride"],
  },

  [AdminCapability.view_invites]: {
    module: "Consultar invitaciones",
    routes: ["/admin/invitations"],
    uiActions: ["view_invite_list", "view_invite_detail"],
    mutations: [],
  },

  [AdminCapability.manage_invites]: {
    module: "Gestionar invitaciones",
    routes: ["/admin/invitations"],
    uiActions: [
      "create_invite",
      "resend_invite",
      "cancel_invite",
      "delete_invite",
    ],
    mutations: ["createInvite", "resendInvite", "revokeInvite", "deleteInvite"],
  },

  [AdminCapability.view_org_members]: {
    module: "Consultar organizaciones",
    routes: ["/admin/organizations"],
    uiActions: ["view_org_list", "view_org_members"],
    mutations: [],
  },

  [AdminCapability.manage_org_members]: {
    module: "Gestionar organizaciones",
    routes: ["/admin/organizations"],
    uiActions: ["create_org", "update_org", "manage_org_membership"],
    mutations: [
      "upsertOrganization",
      "upsertOrgMembership",
      "removeOrgMember",
    ],
  },

  [AdminCapability.view_reports]: {
    module: "Reportes y auditoría",
    routes: ["/admin/reporting", "/admin/audit"],
    uiActions: [
      "view_audit_log",
      "view_reporting_snapshot",
      "run_asset_health",
    ],
    mutations: [],
  },

  [AdminCapability.view_admin_operations]: {
    module: "Operaciones avanzadas (submenu)",
    routes: [
      "/admin/comunicados",
      "/admin/ctas",
      "/admin/whatsapp-templates",
      "/admin/organizations",
      "/admin/reporting",
      "/admin/audit",
    ],
    uiActions: ["access_admin_operations_submenu"],
    mutations: [],
  },

  [AdminCapability.publish_config]: {
    module: "Publicar configuración",
    routes: [],
    uiActions: ["publish_config_version", "rollback_config_version"],
    mutations: ["publishConfigModule", "rollbackConfigVersion"],
  },
};

/**
 * Route-to-capability lookup table.
 *
 * Maps route prefixes to their access requirements, mirroring the
 * page-level requireAdminCapabilityUser() calls.  This is the single
 * place to verify that nav gating and page guards are aligned.
 *
 * Format:
 *   requiredAll  – ALL listed capabilities must be present
 *   requiredAny  – AT LEAST ONE of the listed capabilities must be present
 *
 * A route that requires both uses requiredAll + requiredAny together.
 */
export const ADMIN_ROUTE_GUARDS: Record<
  string,
  { requiredAll?: AdminCapability[]; requiredAny?: AdminCapability[] }
> = {
  // ── Operación ──────────────────────────────────────────────────────────
  "/admin/benefits": {
    requiredAny: [AdminCapability.manage_benefits],
  },
  // NOTE: /admin/prices page does not yet call requireAdminCapabilityUser.
  // TODO: add requireAdminCapabilityUser(AdminCapability.manage_prices) to
  //       src/app/(admin)/admin/(protected)/prices/page.tsx so the guard
  //       matches this matrix entry.
  "/admin/prices": {
    requiredAny: [AdminCapability.manage_prices],
  },
  "/admin/oferta": {
    requiredAny: [AdminCapability.manage_offers],
  },
  "/admin/invitations": {
    requiredAny: [
      AdminCapability.view_invites,
      AdminCapability.manage_invites,
    ],
  },

  // ── Contenido ──────────────────────────────────────────────────────────
  "/admin/comunicados": {
    requiredAll: [AdminCapability.view_admin_operations],
    requiredAny: [AdminCapability.manage_ctas],
  },
  "/admin/ctas": {
    requiredAll: [AdminCapability.view_admin_operations],
    requiredAny: [AdminCapability.manage_ctas],
  },
  "/admin/whatsapp-templates": {
    requiredAll: [AdminCapability.view_admin_operations],
    requiredAny: [AdminCapability.manage_ctas],
  },
  "/admin/whatsapp": {
    requiredAny: [AdminCapability.manage_ctas],
  },
  "/admin/sidebar": {
    requiredAny: [AdminCapability.manage_sidebar],
  },

  // ── Usuarios y acceso ──────────────────────────────────────────────────
  "/admin/users": {
    requiredAny: [AdminCapability.view_users, AdminCapability.manage_users],
  },
  "/admin/organizations": {
    requiredAll: [AdminCapability.view_admin_operations],
    requiredAny: [
      AdminCapability.view_org_members,
      AdminCapability.manage_org_members,
    ],
  },

  // ── UNIDEP ─────────────────────────────────────────────────────────────
  "/admin/unidep/fees": {
    requiredAny: [AdminCapability.manage_prices],
  },
  "/admin/unidep/directory": {
    requiredAny: [AdminCapability.manage_directory],
  },
  "/admin/unidep/programs": {
    requiredAny: [AdminCapability.manage_offers],
  },
  "/admin/unidep/formatos": {
    requiredAny: [AdminCapability.manage_offers],
  },
  "/admin/unidep/campuses": {
    requiredAny: [AdminCapability.manage_directory],
  },

  // ── Desarrollo ─────────────────────────────────────────────────────────
  "/admin/reporting": {
    requiredAll: [AdminCapability.view_admin_operations],
    requiredAny: [AdminCapability.view_reports],
  },
  "/admin/audit": {
    requiredAll: [AdminCapability.view_admin_operations],
    requiredAny: [AdminCapability.view_reports],
  },
};
