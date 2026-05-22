import { Role } from "@prisma/client";

import {
  getActiveAnnouncementsByLocation,
  getUserOrganizationIds,
} from "@/lib/admin-announcements";
import {
  getAppResultsAboveCtas,
  getAppResultsBelowCtas,
  getAppResultsInsideCtas,
  getAuthWelcomeCtas,
  getAuthWelcomeInsideCtas,
  getCalculatorFooterCtas,
  getSimulatorBottomCtas,
  getSimulatorTopCtas,
  getUnidepPrimaryCtas,
} from "@/lib/admin-public";
import { getUserCapabilitySet } from "@/lib/user-capabilities";
import { getAcademicOfferVisibleCycles } from "@/lib/academic-offer-config";
import { listWhatsappTemplatesForUser } from "@/lib/whatsapp-templates";

export async function loadUnidepWorkspaceData(
  userId: string,
  newUser: boolean,
  userRole?: Role | string,
) {
  let ctasBelowResult: Awaited<ReturnType<typeof getAppResultsBelowCtas>> = [];
  let ctasAboveResult: Awaited<ReturnType<typeof getAppResultsAboveCtas>> = [];
  let ctasInsideResult: Awaited<ReturnType<typeof getAppResultsInsideCtas>> = [];
  let resultBelowAnnouncements: Awaited<
    ReturnType<typeof getActiveAnnouncementsByLocation>
  > = [];
  let resultAboveAnnouncements: Awaited<
    ReturnType<typeof getActiveAnnouncementsByLocation>
  > = [];
  let resultInsideAnnouncements: typeof resultAboveAnnouncements = [];
  let authWelcomeAnnouncements: typeof resultAboveAnnouncements = [];
  let authWelcomeInsideAnnouncements: typeof resultAboveAnnouncements = [];
  let unidepPrimaryAnnouncements: typeof resultAboveAnnouncements = [];
  let calculatorFooterAnnouncements: typeof resultAboveAnnouncements = [];
  let simulatorTopAnnouncements: typeof resultAboveAnnouncements = [];
  let simulatorBottomAnnouncements: typeof resultAboveAnnouncements = [];
  let ctasUnidepPrimary: Awaited<ReturnType<typeof getUnidepPrimaryCtas>> = [];
  let ctasCalculatorFooter: Awaited<ReturnType<typeof getCalculatorFooterCtas>> = [];
  let ctasAuthWelcome: Awaited<ReturnType<typeof getAuthWelcomeCtas>> = [];
  let ctasAuthWelcomeInside: Awaited<ReturnType<typeof getAuthWelcomeInsideCtas>> = [];
  let ctasSimulatorTop: Awaited<ReturnType<typeof getSimulatorTopCtas>> = [];
  let ctasSimulatorBottom: Awaited<ReturnType<typeof getSimulatorBottomCtas>> = [];
  let visibleOfferCycles = ["C1"] as Awaited<ReturnType<typeof getAcademicOfferVisibleCycles>>;
  let whatsappTemplates: Awaited<ReturnType<typeof listWhatsappTemplatesForUser>> = {
    templates: [],
    activeTemplateId: null,
    defaultOfficialTemplateId: null,
  };

  try {
    const [organizationIds, userCapabilities] = await Promise.all([
      getUserOrganizationIds(userId),
      getUserCapabilitySet(userId),
    ]);

    [
      ctasBelowResult,
      ctasAboveResult,
      ctasInsideResult,
      resultBelowAnnouncements,
      resultAboveAnnouncements,
      resultInsideAnnouncements,
      authWelcomeAnnouncements,
      authWelcomeInsideAnnouncements,
      unidepPrimaryAnnouncements,
      calculatorFooterAnnouncements,
      simulatorTopAnnouncements,
      simulatorBottomAnnouncements,
      ctasUnidepPrimary,
      ctasCalculatorFooter,
      ctasAuthWelcome,
      ctasAuthWelcomeInside,
      ctasSimulatorTop,
      ctasSimulatorBottom,
      whatsappTemplates,
      visibleOfferCycles,
    ] = await Promise.all([
      getAppResultsBelowCtas({
        userId,
        userOrganizationIds: organizationIds,
        roles: userRole ? [userRole] : [],
        newUser,
        userCapabilities,
      }),
      getAppResultsAboveCtas({
        userId,
        userOrganizationIds: organizationIds,
        roles: userRole ? [userRole] : [],
        newUser,
        userCapabilities,
      }),
      getAppResultsInsideCtas({
        userId,
        userOrganizationIds: organizationIds,
        roles: userRole ? [userRole] : [],
        newUser,
        userCapabilities,
      }),
      getActiveAnnouncementsByLocation({
        location: "APP_RESULTS_BELOW",
        userOrganizationIds: organizationIds,
        newUser,
      }),
      getActiveAnnouncementsByLocation({
        location: "APP_RESULTS_ABOVE",
        userOrganizationIds: organizationIds,
        newUser,
      }),
      getActiveAnnouncementsByLocation({
        location: "APP_RESULTS_INSIDE",
        userOrganizationIds: organizationIds,
        newUser,
      }),
      getActiveAnnouncementsByLocation({
        location: "AUTH_WELCOME",
        userOrganizationIds: organizationIds,
        newUser,
      }),
      getActiveAnnouncementsByLocation({
        location: "AUTH_WELCOME_INSIDE",
        userOrganizationIds: organizationIds,
        newUser,
      }),
      getActiveAnnouncementsByLocation({
        location: "UNIDEP_PRIMARY",
        userOrganizationIds: organizationIds,
        newUser,
      }),
      getActiveAnnouncementsByLocation({
        location: "CALCULATOR_FOOTER",
        userOrganizationIds: organizationIds,
        newUser,
      }),
      getActiveAnnouncementsByLocation({
        location: "SIMULATOR_TOP",
        userOrganizationIds: organizationIds,
        newUser,
      }),
      getActiveAnnouncementsByLocation({
        location: "SIMULATOR_BOTTOM",
        userOrganizationIds: organizationIds,
        newUser,
      }),
      getUnidepPrimaryCtas({
        userId,
        userOrganizationIds: organizationIds,
        roles: userRole ? [userRole] : [],
        newUser,
        userCapabilities,
      }),
      getCalculatorFooterCtas({
        userId,
        userOrganizationIds: organizationIds,
        roles: userRole ? [userRole] : [],
        newUser,
        userCapabilities,
      }),
      getAuthWelcomeCtas({
        userId,
        userOrganizationIds: organizationIds,
        roles: userRole ? [userRole] : [],
        newUser,
        userCapabilities,
      }),
      getAuthWelcomeInsideCtas({
        userId,
        userOrganizationIds: organizationIds,
        roles: userRole ? [userRole] : [],
        newUser,
        userCapabilities,
      }),
      getSimulatorTopCtas({
        userId,
        userOrganizationIds: organizationIds,
        roles: userRole ? [userRole] : [],
        newUser,
        userCapabilities,
      }),
      getSimulatorBottomCtas({
        userId,
        userOrganizationIds: organizationIds,
        roles: userRole ? [userRole] : [],
        newUser,
        userCapabilities,
      }),
      listWhatsappTemplatesForUser(userId),
      getAcademicOfferVisibleCycles(),
    ]);
  } catch {
    // DB unavailable — render page with empty data gracefully.
  }

  return {
    ctasBelowResult,
    ctasAboveResult,
    ctasInsideResult,
    resultBelowAnnouncements,
    ctasUnidepPrimary,
    resultAboveAnnouncements,
    resultInsideAnnouncements,
    authWelcomeAnnouncements,
    authWelcomeInsideAnnouncements,
    unidepPrimaryAnnouncements,
    calculatorFooterAnnouncements,
    simulatorTopAnnouncements,
    simulatorBottomAnnouncements,
    ctasCalculatorFooter,
    ctasAuthWelcome,
    ctasAuthWelcomeInside,
    ctasSimulatorTop,
    ctasSimulatorBottom,
    visibleOfferCycles,
    whatsappTemplates,
  };
}
