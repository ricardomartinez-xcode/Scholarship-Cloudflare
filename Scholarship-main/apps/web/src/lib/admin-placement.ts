import {
  AdminPlacementBreakpoint,
  AdminPlacementPage,
  AdminPlacementPanel,
  AdminPlacementSection,
  AdminPlacementSlot,
  AdminPublicCtaLocation,
} from "@prisma/client";

import {
  buildVisibilityRule as buildTargetingVisibilityRule,
  normalizeVisibilityRule,
  type NormalizedTargetingVisibilityRule,
  type TargetingVisibilityRule,
} from "@/services/targetingVisibilityService";

export type PlacementDescriptor = {
  page: AdminPlacementPage;
  section: AdminPlacementSection;
  panel: AdminPlacementPanel;
  slot: AdminPlacementSlot;
  breakpoint: AdminPlacementBreakpoint;
};

export type VisibilityRule = TargetingVisibilityRule;

const placement = (
  page: AdminPlacementPage,
  section: AdminPlacementSection,
  panel: AdminPlacementPanel,
  slot: AdminPlacementSlot,
  breakpoint: AdminPlacementBreakpoint = AdminPlacementBreakpoint.all,
): PlacementDescriptor => ({ page, section, panel, slot, breakpoint });

export const LEGACY_LOCATION_PLACEMENTS: Record<AdminPublicCtaLocation, PlacementDescriptor> = {
  [AdminPublicCtaLocation.NAV_BANNER]: placement(
    AdminPlacementPage.public_home,
    AdminPlacementSection.navigation,
    AdminPlacementPanel.banner,
    AdminPlacementSlot.top,
  ),
  [AdminPublicCtaLocation.HOME_PRIMARY]: placement(
    AdminPlacementPage.public_home,
    AdminPlacementSection.hero,
    AdminPlacementPanel.primary,
    AdminPlacementSlot.primary,
  ),
  [AdminPublicCtaLocation.HOME_PRIMARY_INSIDE]: placement(
    AdminPlacementPage.public_home,
    AdminPlacementSection.hero,
    AdminPlacementPanel.primary,
    AdminPlacementSlot.inside,
  ),
  [AdminPublicCtaLocation.HOME_SECONDARY]: placement(
    AdminPlacementPage.public_home,
    AdminPlacementSection.content,
    AdminPlacementPanel.secondary,
    AdminPlacementSlot.secondary,
  ),
  [AdminPublicCtaLocation.APP_RESULTS_BELOW]: placement(
    AdminPlacementPage.app_unidep,
    AdminPlacementSection.results,
    AdminPlacementPanel.results,
    AdminPlacementSlot.bottom,
  ),
  [AdminPublicCtaLocation.APP_RESULTS_ABOVE]: placement(
    AdminPlacementPage.app_unidep,
    AdminPlacementSection.results,
    AdminPlacementPanel.results,
    AdminPlacementSlot.top,
  ),
  [AdminPublicCtaLocation.APP_RESULTS_INSIDE]: placement(
    AdminPlacementPage.app_unidep,
    AdminPlacementSection.results,
    AdminPlacementPanel.results,
    AdminPlacementSlot.inside,
  ),
  [AdminPublicCtaLocation.UNIDEP_PRIMARY]: placement(
    AdminPlacementPage.app_unidep,
    AdminPlacementSection.welcome,
    AdminPlacementPanel.primary,
    AdminPlacementSlot.top,
  ),
  [AdminPublicCtaLocation.CALCULATOR_FOOTER]: placement(
    AdminPlacementPage.app_unidep,
    AdminPlacementSection.results,
    AdminPlacementPanel.results,
    AdminPlacementSlot.footer,
  ),
  [AdminPublicCtaLocation.SIDEBAR_TOP]: placement(
    AdminPlacementPage.app_unidep,
    AdminPlacementSection.sidebar,
    AdminPlacementPanel.sidebar,
    AdminPlacementSlot.top,
  ),
  [AdminPublicCtaLocation.SIDEBAR_BOTTOM]: placement(
    AdminPlacementPage.app_unidep,
    AdminPlacementSection.sidebar,
    AdminPlacementPanel.sidebar,
    AdminPlacementSlot.bottom,
  ),
  [AdminPublicCtaLocation.SIMULATOR_TOP]: placement(
    AdminPlacementPage.app_unidep,
    AdminPlacementSection.simulator,
    AdminPlacementPanel.sidebar,
    AdminPlacementSlot.top,
  ),
  [AdminPublicCtaLocation.SIMULATOR_BOTTOM]: placement(
    AdminPlacementPage.app_unidep,
    AdminPlacementSection.simulator,
    AdminPlacementPanel.sidebar,
    AdminPlacementSlot.bottom,
  ),
  [AdminPublicCtaLocation.AUTH_WELCOME]: placement(
    AdminPlacementPage.auth,
    AdminPlacementSection.welcome,
    AdminPlacementPanel.primary,
    AdminPlacementSlot.top,
  ),
  [AdminPublicCtaLocation.AUTH_WELCOME_INSIDE]: placement(
    AdminPlacementPage.auth,
    AdminPlacementSection.welcome,
    AdminPlacementPanel.primary,
    AdminPlacementSlot.inside,
  ),
  [AdminPublicCtaLocation.ADMIN_HEADER_BANNER]: placement(
    AdminPlacementPage.admin,
    AdminPlacementSection.navigation,
    AdminPlacementPanel.header,
    AdminPlacementSlot.top,
  ),
  [AdminPublicCtaLocation.ADMIN_SIDEBAR_TOP]: placement(
    AdminPlacementPage.admin,
    AdminPlacementSection.sidebar,
    AdminPlacementPanel.sidebar,
    AdminPlacementSlot.top,
  ),
  [AdminPublicCtaLocation.ADMIN_SIDEBAR_BOTTOM]: placement(
    AdminPlacementPage.admin,
    AdminPlacementSection.sidebar,
    AdminPlacementPanel.sidebar,
    AdminPlacementSlot.bottom,
  ),
  [AdminPublicCtaLocation.ADMIN_CONTENT_TOP]: placement(
    AdminPlacementPage.admin,
    AdminPlacementSection.module,
    AdminPlacementPanel.content,
    AdminPlacementSlot.actions,
  ),
  [AdminPublicCtaLocation.ADMIN_CONTENT_INSIDE]: placement(
    AdminPlacementPage.admin,
    AdminPlacementSection.module,
    AdminPlacementPanel.content,
    AdminPlacementSlot.inside,
  ),
};

export function getPlacementForLegacyLocation(location: AdminPublicCtaLocation) {
  return LEGACY_LOCATION_PLACEMENTS[location];
}

export function buildVisibilityRule(input: VisibilityRule) {
  return buildTargetingVisibilityRule(input);
}

export function resolveVisibilityRule(raw: unknown): NormalizedTargetingVisibilityRule {
  return normalizeVisibilityRule(raw);
}
