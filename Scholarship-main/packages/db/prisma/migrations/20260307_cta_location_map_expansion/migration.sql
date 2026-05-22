ALTER TYPE "recalc_admin"."AdminPublicCtaLocation"
  ADD VALUE IF NOT EXISTS 'HOME_PRIMARY_INSIDE';

ALTER TYPE "recalc_admin"."AdminPublicCtaLocation"
  ADD VALUE IF NOT EXISTS 'APP_RESULTS_ABOVE';

ALTER TYPE "recalc_admin"."AdminPublicCtaLocation"
  ADD VALUE IF NOT EXISTS 'APP_RESULTS_INSIDE';

ALTER TYPE "recalc_admin"."AdminPublicCtaLocation"
  ADD VALUE IF NOT EXISTS 'SIDEBAR_BOTTOM';

ALTER TYPE "recalc_admin"."AdminPublicCtaLocation"
  ADD VALUE IF NOT EXISTS 'AUTH_WELCOME_INSIDE';

ALTER TYPE "recalc_admin"."AdminPublicCtaLocation"
  ADD VALUE IF NOT EXISTS 'ADMIN_SIDEBAR_BOTTOM';

ALTER TYPE "recalc_admin"."AdminPublicCtaLocation"
  ADD VALUE IF NOT EXISTS 'ADMIN_CONTENT_INSIDE';
