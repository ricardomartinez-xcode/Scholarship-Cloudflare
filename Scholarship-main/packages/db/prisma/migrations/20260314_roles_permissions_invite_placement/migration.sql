DO $$
BEGIN
  CREATE TYPE "recalc_admin"."AdminPlacementPage" AS ENUM ('public_home', 'app_unidep', 'admin', 'auth');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "recalc_admin"."AdminPlacementSection" AS ENUM (
    'navigation',
    'hero',
    'welcome',
    'results',
    'simulator',
    'sidebar',
    'content',
    'module'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "recalc_admin"."AdminPlacementPanel" AS ENUM (
    'banner',
    'primary',
    'secondary',
    'results',
    'sidebar',
    'header',
    'content'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "recalc_admin"."AdminPlacementSlot" AS ENUM (
    'top',
    'inside',
    'bottom',
    'primary',
    'secondary',
    'footer',
    'actions'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "recalc_admin"."AdminPlacementBreakpoint" AS ENUM ('all', 'mobile', 'desktop');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "recalc_admin"."UserCapability" RENAME VALUE 'manage_template' TO 'manage_templates';
ALTER TYPE "recalc_admin"."UserCapability" RENAME VALUE 'manage_comunications' TO 'manage_communications';
ALTER TYPE "recalc_admin"."UserCapability" RENAME VALUE 'owner_permitions' TO 'owner_permissions';

ALTER TYPE "recalc_admin"."Role" RENAME VALUE 'USER' TO 'user';
ALTER TYPE "recalc_admin"."Role" RENAME VALUE 'ADMIN' TO 'admin_operativo';
ALTER TYPE "recalc_admin"."Role" ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE "recalc_admin"."Role" ADD VALUE IF NOT EXISTS 'editor_operativo';

ALTER TABLE "recalc_admin"."admin_public_cta"
  ADD COLUMN IF NOT EXISTS "placementPage" "recalc_admin"."AdminPlacementPage" NOT NULL DEFAULT 'public_home',
  ADD COLUMN IF NOT EXISTS "placementSection" "recalc_admin"."AdminPlacementSection" NOT NULL DEFAULT 'hero',
  ADD COLUMN IF NOT EXISTS "placementPanel" "recalc_admin"."AdminPlacementPanel" NOT NULL DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS "placementSlot" "recalc_admin"."AdminPlacementSlot" NOT NULL DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS "placementBreakpoint" "recalc_admin"."AdminPlacementBreakpoint" NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS "placementOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "visibilityRule" JSONB;

ALTER TABLE "recalc_admin"."admin_announcement"
  ADD COLUMN IF NOT EXISTS "placementPage" "recalc_admin"."AdminPlacementPage" NOT NULL DEFAULT 'public_home',
  ADD COLUMN IF NOT EXISTS "placementSection" "recalc_admin"."AdminPlacementSection" NOT NULL DEFAULT 'hero',
  ADD COLUMN IF NOT EXISTS "placementPanel" "recalc_admin"."AdminPlacementPanel" NOT NULL DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS "placementSlot" "recalc_admin"."AdminPlacementSlot" NOT NULL DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS "placementBreakpoint" "recalc_admin"."AdminPlacementBreakpoint" NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS "placementOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "visibilityRule" JSONB;

UPDATE "recalc_admin"."admin_public_cta"
SET
  "placementPage" = CASE "location"
    WHEN 'NAV_BANNER' THEN 'public_home'
    WHEN 'HOME_PRIMARY' THEN 'public_home'
    WHEN 'HOME_PRIMARY_INSIDE' THEN 'public_home'
    WHEN 'HOME_SECONDARY' THEN 'public_home'
    WHEN 'APP_RESULTS_BELOW' THEN 'app_unidep'
    WHEN 'APP_RESULTS_ABOVE' THEN 'app_unidep'
    WHEN 'APP_RESULTS_INSIDE' THEN 'app_unidep'
    WHEN 'UNIDEP_PRIMARY' THEN 'app_unidep'
    WHEN 'CALCULATOR_FOOTER' THEN 'app_unidep'
    WHEN 'SIDEBAR_TOP' THEN 'app_unidep'
    WHEN 'SIDEBAR_BOTTOM' THEN 'app_unidep'
    WHEN 'SIMULATOR_TOP' THEN 'app_unidep'
    WHEN 'SIMULATOR_BOTTOM' THEN 'app_unidep'
    WHEN 'AUTH_WELCOME' THEN 'auth'
    WHEN 'AUTH_WELCOME_INSIDE' THEN 'auth'
    WHEN 'ADMIN_HEADER_BANNER' THEN 'admin'
    WHEN 'ADMIN_SIDEBAR_TOP' THEN 'admin'
    WHEN 'ADMIN_SIDEBAR_BOTTOM' THEN 'admin'
    WHEN 'ADMIN_CONTENT_TOP' THEN 'admin'
    WHEN 'ADMIN_CONTENT_INSIDE' THEN 'admin'
    ELSE 'public_home'
  END::"recalc_admin"."AdminPlacementPage",
  "placementSection" = CASE "location"
    WHEN 'NAV_BANNER' THEN 'navigation'
    WHEN 'HOME_PRIMARY' THEN 'hero'
    WHEN 'HOME_PRIMARY_INSIDE' THEN 'hero'
    WHEN 'HOME_SECONDARY' THEN 'content'
    WHEN 'APP_RESULTS_BELOW' THEN 'results'
    WHEN 'APP_RESULTS_ABOVE' THEN 'results'
    WHEN 'APP_RESULTS_INSIDE' THEN 'results'
    WHEN 'UNIDEP_PRIMARY' THEN 'welcome'
    WHEN 'CALCULATOR_FOOTER' THEN 'results'
    WHEN 'SIDEBAR_TOP' THEN 'sidebar'
    WHEN 'SIDEBAR_BOTTOM' THEN 'sidebar'
    WHEN 'SIMULATOR_TOP' THEN 'simulator'
    WHEN 'SIMULATOR_BOTTOM' THEN 'simulator'
    WHEN 'AUTH_WELCOME' THEN 'welcome'
    WHEN 'AUTH_WELCOME_INSIDE' THEN 'welcome'
    WHEN 'ADMIN_HEADER_BANNER' THEN 'navigation'
    WHEN 'ADMIN_SIDEBAR_TOP' THEN 'sidebar'
    WHEN 'ADMIN_SIDEBAR_BOTTOM' THEN 'sidebar'
    WHEN 'ADMIN_CONTENT_TOP' THEN 'module'
    WHEN 'ADMIN_CONTENT_INSIDE' THEN 'module'
    ELSE 'content'
  END::"recalc_admin"."AdminPlacementSection",
  "placementPanel" = CASE "location"
    WHEN 'NAV_BANNER' THEN 'banner'
    WHEN 'HOME_PRIMARY' THEN 'primary'
    WHEN 'HOME_PRIMARY_INSIDE' THEN 'primary'
    WHEN 'HOME_SECONDARY' THEN 'secondary'
    WHEN 'APP_RESULTS_BELOW' THEN 'results'
    WHEN 'APP_RESULTS_ABOVE' THEN 'results'
    WHEN 'APP_RESULTS_INSIDE' THEN 'results'
    WHEN 'UNIDEP_PRIMARY' THEN 'primary'
    WHEN 'CALCULATOR_FOOTER' THEN 'results'
    WHEN 'SIDEBAR_TOP' THEN 'sidebar'
    WHEN 'SIDEBAR_BOTTOM' THEN 'sidebar'
    WHEN 'SIMULATOR_TOP' THEN 'sidebar'
    WHEN 'SIMULATOR_BOTTOM' THEN 'sidebar'
    WHEN 'AUTH_WELCOME' THEN 'primary'
    WHEN 'AUTH_WELCOME_INSIDE' THEN 'primary'
    WHEN 'ADMIN_HEADER_BANNER' THEN 'header'
    WHEN 'ADMIN_SIDEBAR_TOP' THEN 'sidebar'
    WHEN 'ADMIN_SIDEBAR_BOTTOM' THEN 'sidebar'
    WHEN 'ADMIN_CONTENT_TOP' THEN 'content'
    WHEN 'ADMIN_CONTENT_INSIDE' THEN 'content'
    ELSE 'content'
  END::"recalc_admin"."AdminPlacementPanel",
  "placementSlot" = CASE "location"
    WHEN 'HOME_PRIMARY' THEN 'primary'
    WHEN 'HOME_PRIMARY_INSIDE' THEN 'inside'
    WHEN 'HOME_SECONDARY' THEN 'secondary'
    WHEN 'APP_RESULTS_BELOW' THEN 'bottom'
    WHEN 'APP_RESULTS_ABOVE' THEN 'top'
    WHEN 'APP_RESULTS_INSIDE' THEN 'inside'
    WHEN 'UNIDEP_PRIMARY' THEN 'top'
    WHEN 'CALCULATOR_FOOTER' THEN 'footer'
    WHEN 'NAV_BANNER' THEN 'top'
    WHEN 'SIDEBAR_TOP' THEN 'top'
    WHEN 'SIDEBAR_BOTTOM' THEN 'bottom'
    WHEN 'SIMULATOR_TOP' THEN 'top'
    WHEN 'SIMULATOR_BOTTOM' THEN 'bottom'
    WHEN 'AUTH_WELCOME' THEN 'top'
    WHEN 'AUTH_WELCOME_INSIDE' THEN 'inside'
    WHEN 'ADMIN_HEADER_BANNER' THEN 'top'
    WHEN 'ADMIN_SIDEBAR_TOP' THEN 'top'
    WHEN 'ADMIN_SIDEBAR_BOTTOM' THEN 'bottom'
    WHEN 'ADMIN_CONTENT_TOP' THEN 'actions'
    WHEN 'ADMIN_CONTENT_INSIDE' THEN 'inside'
    ELSE 'top'
  END::"recalc_admin"."AdminPlacementSlot",
  "placementBreakpoint" = 'all',
  "placementOrder" = "sortOrder",
  "visibilityRule" = jsonb_strip_nulls(
    jsonb_build_object(
      'organizationId', "organizationId",
      'newUserOnly', CASE WHEN "onlyNewUsers" THEN true ELSE NULL END,
      'requiredCapability', CASE
        WHEN "requiredCapability" IS NULL THEN NULL
        ELSE "requiredCapability"::text
      END
    )
  );

UPDATE "recalc_admin"."admin_announcement"
SET
  "placementPage" = CASE "location"
    WHEN 'NAV_BANNER' THEN 'public_home'
    WHEN 'HOME_PRIMARY' THEN 'public_home'
    WHEN 'HOME_PRIMARY_INSIDE' THEN 'public_home'
    WHEN 'HOME_SECONDARY' THEN 'public_home'
    WHEN 'APP_RESULTS_BELOW' THEN 'app_unidep'
    WHEN 'APP_RESULTS_ABOVE' THEN 'app_unidep'
    WHEN 'APP_RESULTS_INSIDE' THEN 'app_unidep'
    WHEN 'UNIDEP_PRIMARY' THEN 'app_unidep'
    WHEN 'CALCULATOR_FOOTER' THEN 'app_unidep'
    WHEN 'SIDEBAR_TOP' THEN 'app_unidep'
    WHEN 'SIDEBAR_BOTTOM' THEN 'app_unidep'
    WHEN 'SIMULATOR_TOP' THEN 'app_unidep'
    WHEN 'SIMULATOR_BOTTOM' THEN 'app_unidep'
    WHEN 'AUTH_WELCOME' THEN 'auth'
    WHEN 'AUTH_WELCOME_INSIDE' THEN 'auth'
    WHEN 'ADMIN_HEADER_BANNER' THEN 'admin'
    WHEN 'ADMIN_SIDEBAR_TOP' THEN 'admin'
    WHEN 'ADMIN_SIDEBAR_BOTTOM' THEN 'admin'
    WHEN 'ADMIN_CONTENT_TOP' THEN 'admin'
    WHEN 'ADMIN_CONTENT_INSIDE' THEN 'admin'
    ELSE 'public_home'
  END::"recalc_admin"."AdminPlacementPage",
  "placementSection" = CASE "location"
    WHEN 'NAV_BANNER' THEN 'navigation'
    WHEN 'HOME_PRIMARY' THEN 'hero'
    WHEN 'HOME_PRIMARY_INSIDE' THEN 'hero'
    WHEN 'HOME_SECONDARY' THEN 'content'
    WHEN 'APP_RESULTS_BELOW' THEN 'results'
    WHEN 'APP_RESULTS_ABOVE' THEN 'results'
    WHEN 'APP_RESULTS_INSIDE' THEN 'results'
    WHEN 'UNIDEP_PRIMARY' THEN 'welcome'
    WHEN 'CALCULATOR_FOOTER' THEN 'results'
    WHEN 'SIDEBAR_TOP' THEN 'sidebar'
    WHEN 'SIDEBAR_BOTTOM' THEN 'sidebar'
    WHEN 'SIMULATOR_TOP' THEN 'simulator'
    WHEN 'SIMULATOR_BOTTOM' THEN 'simulator'
    WHEN 'AUTH_WELCOME' THEN 'welcome'
    WHEN 'AUTH_WELCOME_INSIDE' THEN 'welcome'
    WHEN 'ADMIN_HEADER_BANNER' THEN 'navigation'
    WHEN 'ADMIN_SIDEBAR_TOP' THEN 'sidebar'
    WHEN 'ADMIN_SIDEBAR_BOTTOM' THEN 'sidebar'
    WHEN 'ADMIN_CONTENT_TOP' THEN 'module'
    WHEN 'ADMIN_CONTENT_INSIDE' THEN 'module'
    ELSE 'content'
  END::"recalc_admin"."AdminPlacementSection",
  "placementPanel" = CASE "location"
    WHEN 'NAV_BANNER' THEN 'banner'
    WHEN 'HOME_PRIMARY' THEN 'primary'
    WHEN 'HOME_PRIMARY_INSIDE' THEN 'primary'
    WHEN 'HOME_SECONDARY' THEN 'secondary'
    WHEN 'APP_RESULTS_BELOW' THEN 'results'
    WHEN 'APP_RESULTS_ABOVE' THEN 'results'
    WHEN 'APP_RESULTS_INSIDE' THEN 'results'
    WHEN 'UNIDEP_PRIMARY' THEN 'primary'
    WHEN 'CALCULATOR_FOOTER' THEN 'results'
    WHEN 'SIDEBAR_TOP' THEN 'sidebar'
    WHEN 'SIDEBAR_BOTTOM' THEN 'sidebar'
    WHEN 'SIMULATOR_TOP' THEN 'sidebar'
    WHEN 'SIMULATOR_BOTTOM' THEN 'sidebar'
    WHEN 'AUTH_WELCOME' THEN 'primary'
    WHEN 'AUTH_WELCOME_INSIDE' THEN 'primary'
    WHEN 'ADMIN_HEADER_BANNER' THEN 'header'
    WHEN 'ADMIN_SIDEBAR_TOP' THEN 'sidebar'
    WHEN 'ADMIN_SIDEBAR_BOTTOM' THEN 'sidebar'
    WHEN 'ADMIN_CONTENT_TOP' THEN 'content'
    WHEN 'ADMIN_CONTENT_INSIDE' THEN 'content'
    ELSE 'content'
  END::"recalc_admin"."AdminPlacementPanel",
  "placementSlot" = CASE "location"
    WHEN 'HOME_PRIMARY' THEN 'primary'
    WHEN 'HOME_PRIMARY_INSIDE' THEN 'inside'
    WHEN 'HOME_SECONDARY' THEN 'secondary'
    WHEN 'APP_RESULTS_BELOW' THEN 'bottom'
    WHEN 'APP_RESULTS_ABOVE' THEN 'top'
    WHEN 'APP_RESULTS_INSIDE' THEN 'inside'
    WHEN 'UNIDEP_PRIMARY' THEN 'top'
    WHEN 'CALCULATOR_FOOTER' THEN 'footer'
    WHEN 'NAV_BANNER' THEN 'top'
    WHEN 'SIDEBAR_TOP' THEN 'top'
    WHEN 'SIDEBAR_BOTTOM' THEN 'bottom'
    WHEN 'SIMULATOR_TOP' THEN 'top'
    WHEN 'SIMULATOR_BOTTOM' THEN 'bottom'
    WHEN 'AUTH_WELCOME' THEN 'top'
    WHEN 'AUTH_WELCOME_INSIDE' THEN 'inside'
    WHEN 'ADMIN_HEADER_BANNER' THEN 'top'
    WHEN 'ADMIN_SIDEBAR_TOP' THEN 'top'
    WHEN 'ADMIN_SIDEBAR_BOTTOM' THEN 'bottom'
    WHEN 'ADMIN_CONTENT_TOP' THEN 'actions'
    WHEN 'ADMIN_CONTENT_INSIDE' THEN 'inside'
    ELSE 'top'
  END::"recalc_admin"."AdminPlacementSlot",
  "placementBreakpoint" = 'all',
  "placementOrder" = "sortOrder",
  "visibilityRule" = jsonb_strip_nulls(
    jsonb_build_object(
      'organizationId', "organizationId",
      'newUserOnly', CASE WHEN "onlyNewUsers" THEN true ELSE NULL END
    )
  );

CREATE INDEX IF NOT EXISTS "admin_public_cta_placement_idx"
  ON "recalc_admin"."admin_public_cta"(
    "placementPage",
    "placementSection",
    "placementPanel",
    "placementSlot",
    "placementBreakpoint",
    "placementOrder"
  );

CREATE INDEX IF NOT EXISTS "admin_announcement_placement_idx"
  ON "recalc_admin"."admin_announcement"(
    "placementPage",
    "placementSection",
    "placementPanel",
    "placementSlot",
    "placementBreakpoint",
    "placementOrder"
  );
