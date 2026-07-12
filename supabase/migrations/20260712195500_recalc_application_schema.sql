-- Generated from packages/db/prisma/schema.prisma with Prisma migrate diff.
-- This migration adds the application domain schema to Supabase PostgreSQL.
-- It is intentionally additive and must only be applied to Supabase staging first.
BEGIN;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "recalc_admin";

-- CreateEnum
CREATE TYPE "recalc_admin"."AdminPublicCtaKind" AS ENUM ('link', 'action');

-- CreateEnum
CREATE TYPE "recalc_admin"."AdminAnnouncementDisplay" AS ENUM ('banner', 'popout');

-- CreateEnum
CREATE TYPE "recalc_admin"."AdminPublicCtaLocation" AS ENUM ('HOME_PRIMARY', 'HOME_PRIMARY_INSIDE', 'HOME_SECONDARY', 'APP_RESULTS_BELOW', 'APP_RESULTS_ABOVE', 'APP_RESULTS_INSIDE', 'UNIDEP_PRIMARY', 'CALCULATOR_FOOTER', 'NAV_BANNER', 'SIDEBAR_TOP', 'SIDEBAR_BOTTOM', 'SIMULATOR_TOP', 'SIMULATOR_BOTTOM', 'AUTH_WELCOME', 'AUTH_WELCOME_INSIDE', 'ADMIN_HEADER_BANNER', 'ADMIN_SIDEBAR_TOP', 'ADMIN_SIDEBAR_BOTTOM', 'ADMIN_CONTENT_TOP', 'ADMIN_CONTENT_INSIDE');

-- CreateEnum
CREATE TYPE "recalc_admin"."AdminConfigModule" AS ENUM ('ACCESS', 'BENEFITS', 'PRICES', 'CTAS', 'SIDEBAR', 'DIRECTORY', 'OFFER');

-- CreateEnum
CREATE TYPE "recalc_admin"."AdminCapability" AS ENUM ('view_admin', 'manage_benefits', 'manage_prices', 'manage_ctas', 'manage_sidebar', 'manage_offers', 'manage_directory', 'view_users', 'manage_users', 'view_invites', 'manage_invites', 'view_org_members', 'manage_org_members', 'view_reports', 'view_admin_operations', 'publish_config');

-- CreateEnum
CREATE TYPE "recalc_admin"."UserCapability" AS ENUM ('access_admin_cta', 'user_vip', 'view_audit', 'manage_templates', 'manage_communications', 'owner_permissions');

-- CreateEnum
CREATE TYPE "recalc_admin"."UserAgendaItemType" AS ENUM ('recordatorio', 'pago', 'pendiente');

-- CreateEnum
CREATE TYPE "recalc_admin"."UserAgendaItemStatus" AS ENUM ('abierto', 'hecho', 'cancelado');

-- CreateEnum
CREATE TYPE "recalc_admin"."AdminUiModule" AS ENUM ('ADMIN_HOME', 'USERS', 'INVITATIONS', 'ORGANIZATIONS', 'AUDIT', 'BENEFITS', 'PRICES', 'CTAS', 'SIDEBAR', 'OFFER', 'DIRECTORY', 'CAMPUSES', 'FEES', 'PROGRAMS');

-- CreateEnum
CREATE TYPE "recalc_admin"."WhatsappTemplateStatus" AS ENUM ('personal', 'submitted_for_review', 'approved', 'rejected', 'official', 'archived');

-- CreateEnum
CREATE TYPE "recalc_admin"."WhatsappTemplateKind" AS ENUM ('summary', 'detailed');

-- CreateEnum
CREATE TYPE "recalc_admin"."AdminAuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'ROLLBACK', 'IMPORT_VALIDATE', 'IMPORT_APPLY', 'IMPORT_ROLLBACK');

-- CreateEnum
CREATE TYPE "recalc_admin"."AdminChangeSource" AS ENUM ('UI', 'IMPORT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "recalc_admin"."AdminImportSessionStatus" AS ENUM ('preview', 'applied', 'rolled_back', 'failed');

-- CreateEnum
CREATE TYPE "recalc_admin"."CampusKind" AS ENUM ('campus', 'online');

-- CreateEnum
CREATE TYPE "recalc_admin"."ProgramOfferingDelivery" AS ENUM ('CAMPUS', 'ONLINE');

-- CreateEnum
CREATE TYPE "recalc_admin"."BenefitBusinessLine" AS ENUM ('salud', 'licenciatura', 'prepa', 'posgrado');

-- CreateEnum
CREATE TYPE "recalc_admin"."AcademicFeeSection" AS ENUM ('EXAMENES', 'TRAMITES', 'DIVERSOS');

-- CreateEnum
CREATE TYPE "recalc_admin"."BenefitModality" AS ENUM ('presencial', 'mixta', 'online');

-- CreateEnum
CREATE TYPE "recalc_admin"."BenefitDuration" AS ENUM ('primer_cuatrimestre', 'toda_la_carrera', 'pago_inicial');

-- CreateEnum
CREATE TYPE "recalc_admin"."AdminPlacementPage" AS ENUM ('public_home', 'app_unidep', 'admin', 'auth');

-- CreateEnum
CREATE TYPE "recalc_admin"."AdminPlacementSection" AS ENUM ('navigation', 'hero', 'welcome', 'results', 'simulator', 'sidebar', 'content', 'module');

-- CreateEnum
CREATE TYPE "recalc_admin"."AdminPlacementPanel" AS ENUM ('banner', 'primary', 'secondary', 'results', 'sidebar', 'header', 'content');

-- CreateEnum
CREATE TYPE "recalc_admin"."AdminPlacementSlot" AS ENUM ('top', 'inside', 'bottom', 'primary', 'secondary', 'footer', 'actions');

-- CreateEnum
CREATE TYPE "recalc_admin"."AdminPlacementBreakpoint" AS ENUM ('all', 'mobile', 'desktop');

-- CreateEnum
CREATE TYPE "recalc_admin"."AdminAdditionalBenefitType" AS ENUM ('percentage', 'first_payment', 'fixed_scholarship');

-- CreateEnum
CREATE TYPE "recalc_admin"."EnrollmentType" AS ENUM ('nuevo_ingreso', 'regreso', 'reingreso');

-- CreateEnum
CREATE TYPE "recalc_admin"."CanonicalModality" AS ENUM ('presencial', 'mixta', 'online');

-- CreateEnum
CREATE TYPE "recalc_admin"."QuoteScenarioKind" AS ENUM ('DRAFT', 'SAVED');

-- CreateEnum
CREATE TYPE "recalc_admin"."BusinessEventType" AS ENUM ('QUOTE_GENERATED', 'QUOTE_SIMULATED', 'QUOTE_SCENARIO_SAVED', 'QUOTE_SCENARIO_LOADED', 'QUOTE_COMPARISON_VIEWED', 'CTA_CLICKED', 'BENEFIT_APPLIED', 'INVITE_CREATED', 'INVITE_RESENT', 'OFFER_PUBLISHED', 'IMPORT_VALIDATED', 'IMPORT_APPLIED', 'IMPORT_ROLLED_BACK', 'IMPORT_FAILED', 'EXTENSION_TOKEN_ISSUED', 'EXTENSION_RUN_CREATED', 'EXTENSION_RUN_EVENT', 'WHATSAPP_WEB_OPENED');

-- CreateEnum
CREATE TYPE "recalc_admin"."ProgramAssetType" AS ENUM ('PLAN_PDF', 'BROCHURE_PDF', 'PLAN_URL', 'PLAN_DRIVE_LINK');

-- CreateEnum
CREATE TYPE "recalc_admin"."ProgramAssetStatus" AS ENUM ('healthy', 'broken', 'timeout', 'unauthorized', 'skipped');

-- CreateEnum
CREATE TYPE "recalc_admin"."DirectoryContactMethodType" AS ENUM ('EMAIL', 'PHONE', 'WHATSAPP', 'URL', 'OTHER');

-- CreateEnum
CREATE TYPE "recalc_admin"."Role" AS ENUM ('owner', 'admin_operativo', 'editor_operativo', 'user');

-- CreateEnum
CREATE TYPE "recalc_admin"."OrgRole" AS ENUM ('owner', 'admin', 'member');

-- CreateEnum
CREATE TYPE "recalc_admin"."TrainingAccessRole" AS ENUM ('user', 'moderator', 'admin', 'owner');

-- CreateEnum
CREATE TYPE "recalc_admin"."TrainingChatStatus" AS ENUM ('open', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "recalc_admin"."InboxThreadStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "recalc_admin"."TrainingRoomVisibility" AS ENUM ('private', 'org', 'public');

-- CreateEnum
CREATE TYPE "recalc_admin"."TrainingRoomRole" AS ENUM ('participant', 'trainer', 'facilitator');

-- CreateTable
CREATE TABLE "recalc_admin"."campus" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "metaKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tier" TEXT,
    "kind" "recalc_admin"."CampusKind" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "address" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."program" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "level" TEXT,
    "category" TEXT,
    "planDriveFileId" TEXT,
    "planDriveLink" TEXT,
    "planUrl" TEXT,
    "businessLine" "recalc_admin"."BenefitBusinessLine",
    "planPdfUrl" TEXT,
    "brochurePdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."enrollment_format" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileMimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "sourceType" TEXT NOT NULL DEFAULT 'link',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollment_format_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."quote_session" (
    "id" UUID NOT NULL,
    "publicId" TEXT NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "quoteMode" TEXT NOT NULL,
    "lastOpenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."quote_scenario" (
    "id" UUID NOT NULL,
    "quoteSessionId" UUID NOT NULL,
    "kind" "recalc_admin"."QuoteScenarioKind" NOT NULL DEFAULT 'DRAFT',
    "label" TEXT NOT NULL,
    "inputFingerprint" TEXT NOT NULL,
    "inputJson" JSONB NOT NULL,
    "resultJson" JSONB NOT NULL,
    "enrollmentType" "recalc_admin"."EnrollmentType" NOT NULL,
    "businessLine" "recalc_admin"."BenefitBusinessLine" NOT NULL,
    "modality" "recalc_admin"."CanonicalModality" NOT NULL,
    "plan" INTEGER NOT NULL,
    "campusId" UUID,
    "campusNameSnapshot" TEXT,
    "programId" UUID,
    "programNameSnapshot" TEXT,
    "average" DECIMAL(4,2) NOT NULL,
    "subjectCount" INTEGER,
    "extraChargeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "basePriceMxn" DECIMAL(12,2) NOT NULL,
    "scholarshipPercent" DECIMAL(5,2) NOT NULL,
    "scholarshipAmountMxn" DECIMAL(12,2) NOT NULL,
    "additionalBenefitPercent" DECIMAL(5,2) NOT NULL,
    "additionalBenefitAmountMxn" DECIMAL(12,2) NOT NULL,
    "firstPaymentAmountMxn" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotalMxn" DECIMAL(12,2) NOT NULL,
    "totalMxn" DECIMAL(12,2) NOT NULL,
    "sinAccessToScholarship" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_scenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."business_event" (
    "id" UUID NOT NULL,
    "type" "recalc_admin"."BusinessEventType" NOT NULL,
    "userId" UUID,
    "quoteSessionId" UUID,
    "quoteScenarioId" UUID,
    "subjectType" TEXT,
    "subjectId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."program_asset_check" (
    "id" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "assetType" "recalc_admin"."ProgramAssetType" NOT NULL,
    "url" TEXT NOT NULL,
    "status" "recalc_admin"."ProgramAssetStatus" NOT NULL,
    "httpStatus" INTEGER,
    "contentType" TEXT,
    "error" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_asset_check_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."program_offering" (
    "id" UUID NOT NULL,
    "campusId" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "cycle" TEXT NOT NULL,
    "track" TEXT DEFAULT 'Longitudinal',
    "delivery" "recalc_admin"."ProgramOfferingDelivery" NOT NULL DEFAULT 'CAMPUS',
    "escolarizado" BOOLEAN NOT NULL DEFAULT false,
    "ejecutivo" BOOLEAN NOT NULL DEFAULT false,
    "escolarizadoSchedule" TEXT,
    "ejecutivoSchedule" TEXT,
    "lineOfBusiness" TEXT,
    "pricingPlans" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "module_count" INTEGER,
    "subjects_by_module" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "archivedReason" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_offering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."directory_contact" (
    "id" UUID NOT NULL,
    "campusId" UUID NOT NULL,
    "zone" TEXT,
    "role" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "contactLabel" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "directory_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."directory_contact_method" (
    "id" UUID NOT NULL,
    "directoryContactId" UUID NOT NULL,
    "type" "recalc_admin"."DirectoryContactMethodType" NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "directory_contact_method_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."bulletin" (
    "id" UUID NOT NULL,
    "campusId" UUID NOT NULL,
    "cycle" TEXT,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulletin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."user" (
    "id" UUID NOT NULL,
    "authUserId" TEXT,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "role" "recalc_admin"."Role" NOT NULL DEFAULT 'user',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."user_agenda_item" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "recalc_admin"."UserAgendaItemType" NOT NULL,
    "status" "recalc_admin"."UserAgendaItemStatus" NOT NULL DEFAULT 'abierto',
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_agenda_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."user_contact" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "contactName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "waId" TEXT,
    "bsuid" TEXT,
    "parentBsuid" TEXT,
    "whatsappUsername" TEXT,
    "profilePictureUrl" TEXT,
    "profileSource" TEXT,
    "lastProfileSyncAt" TIMESTAMP(3),
    "lastIdentitySyncAt" TIMESTAMP(3),
    "email" TEXT,
    "tags" JSONB,
    "personalData" TEXT,
    "notes" TEXT,
    "lastWhatsappMessageAt" TIMESTAMP(3),
    "lastWhatsappMessageText" TEXT,
    "campaignMessageCount" INTEGER NOT NULL DEFAULT 0,
    "assignedQuoteSessionPublicId" TEXT,
    "assignedScenarioId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sheetSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."extension_campaign" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "campaignName" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp_web',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "scheduleAt" TIMESTAMP(3),
    "batchSize" INTEGER NOT NULL DEFAULT 25,
    "messageTemplate" TEXT,
    "messageDelayMs" INTEGER NOT NULL DEFAULT 4000,
    "mediaUrl" TEXT,
    "notes" TEXT,
    "meta" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extension_campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."extension_campaign_recipient" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "externalKey" TEXT,
    "contactValue" TEXT NOT NULL,
    "contactName" TEXT,
    "payload" JSONB,
    "scheduledFor" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attemptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extension_campaign_recipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."extension_session_token" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'extension:default',
    "client" TEXT,
    "extensionVersion" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extension_session_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."user_google_connection" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "encryptedAccessToken" TEXT,
    "encryptedRefreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "scopes" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "calendarConnected" BOOLEAN NOT NULL DEFAULT false,
    "tasksConnected" BOOLEAN NOT NULL DEFAULT false,
    "sheetsConnected" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_google_connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."user_push_subscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "expirationTime" TIMESTAMP(3),
    "publicKey" TEXT NOT NULL,
    "authToken" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_push_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."user_meta_whatsapp_connection" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'meta_whatsapp',
    "encryptedMetaAccessToken" TEXT,
    "encryptedSystemUserToken" TEXT,
    "graphApiVersion" TEXT NOT NULL DEFAULT 'v25.0',
    "wabaId" TEXT,
    "phoneNumberId" TEXT,
    "businessAccountId" TEXT,
    "businessManagerId" TEXT,
    "businessName" TEXT,
    "wabaName" TEXT,
    "wabaCurrency" TEXT,
    "wabaTimezoneId" TEXT,
    "phoneDisplayNumber" TEXT,
    "phoneVerifiedName" TEXT,
    "phoneQualityRating" TEXT,
    "phoneCodeVerificationStatus" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3),
    "lastAssetSyncAt" TIMESTAMP(3),
    "lastTemplateSyncAt" TIMESTAMP(3),
    "lastWebhookAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lastSyncError" TEXT,
    "grantedScopes" JSONB,
    "accountReviewSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_meta_whatsapp_connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."meta_embedded_signup_session" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "connectionId" UUID,
    "clientSessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'started',
    "flowType" TEXT,
    "appId" TEXT,
    "configId" TEXT,
    "sessionInfoVersion" INTEGER,
    "graphApiVersion" TEXT DEFAULT 'v25.0',
    "facebookUserId" TEXT,
    "facebookLoginStatus" TEXT,
    "encryptedAuthorizationCode" TEXT,
    "authorizationCodeReceivedAt" TIMESTAMP(3),
    "wabaId" TEXT,
    "phoneNumberId" TEXT,
    "businessAccountId" TEXT,
    "cancelRedirectUrl" TEXT,
    "dataDeletionRequestUrl" TEXT,
    "dataDeletionCallbackUrl" TEXT,
    "errorMessage" TEXT,
    "payload" JSONB,
    "finishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "exchangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_embedded_signup_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."meta_whatsapp_message" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "connectionId" UUID,
    "contactId" UUID,
    "metaMessageId" TEXT,
    "direction" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "templateName" TEXT,
    "templateLanguage" TEXT,
    "textBody" TEXT,
    "mediaId" TEXT,
    "mediaMimeType" TEXT,
    "mediaSha256" TEXT,
    "mediaCaption" TEXT,
    "externalStatus" TEXT,
    "conversationId" TEXT,
    "pricingCategory" TEXT,
    "errorCode" TEXT,
    "errorTitle" TEXT,
    "errorMessage" TEXT,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_whatsapp_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."meta_whatsapp_message_event" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "connectionId" UUID,
    "contactId" UUID,
    "messageId" UUID,
    "metaMessageId" TEXT,
    "eventType" TEXT NOT NULL,
    "deliveryStatus" TEXT,
    "payload" JSONB,
    "eventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meta_whatsapp_message_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."agenda_sync_preference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "googleConnectionId" UUID,
    "syncCalendarEnabled" BOOLEAN NOT NULL DEFAULT false,
    "syncTasksEnabled" BOOLEAN NOT NULL DEFAULT false,
    "syncSheetsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "calendarId" TEXT,
    "tasklistId" TEXT,
    "spreadsheetId" TEXT,
    "worksheetName" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agenda_sync_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."agenda_external_sync" (
    "id" UUID NOT NULL,
    "agendaItemId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agenda_external_sync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."admin_user_capability" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "capability" "recalc_admin"."AdminCapability" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedByUserId" UUID,
    "updatedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_user_capability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."user_capability_assignment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "capability" "recalc_admin"."UserCapability" NOT NULL,
    "grantedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_capability_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."admin_ui_preference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "module" "recalc_admin"."AdminUiModule" NOT NULL,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_ui_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."whatsapp_template" (
    "id" UUID NOT NULL,
    "systemKey" TEXT,
    "name" TEXT NOT NULL,
    "kind" "recalc_admin"."WhatsappTemplateKind" NOT NULL DEFAULT 'detailed',
    "status" "recalc_admin"."WhatsappTemplateStatus" NOT NULL DEFAULT 'personal',
    "ownerUserId" UUID,
    "authorUserId" UUID,
    "sourceTemplateId" UUID,
    "isDefaultOfficial" BOOLEAN NOT NULL DEFAULT false,
    "baseText" TEXT,
    "fieldOrder" JSONB NOT NULL,
    "reviewNotes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" UUID,
    "reviewedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."whatsapp_template_preference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "activeTemplateId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_template_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."invite" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "recalc_admin"."Role" NOT NULL DEFAULT 'user',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" UUID,
    "lastSentAt" TIMESTAMP(3),
    "resentCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" UUID NOT NULL,
    "organizationId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."admin_additional_benefit" (
    "id" UUID NOT NULL,
    "appliesToAll" BOOLEAN NOT NULL DEFAULT false,
    "benefitType" "recalc_admin"."AdminAdditionalBenefitType" NOT NULL DEFAULT 'percentage',
    "enrollmentType" "recalc_admin"."EnrollmentType",
    "extraPercent" INTEGER NOT NULL,
    "firstPaymentAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "businessLine" "recalc_admin"."BenefitBusinessLine",
    "modality" "recalc_admin"."BenefitModality",
    "duration" "recalc_admin"."BenefitDuration",
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_additional_benefit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."admin_additional_benefit_campus" (
    "benefitId" UUID NOT NULL,
    "campusId" UUID NOT NULL,

    CONSTRAINT "admin_additional_benefit_campus_pkey" PRIMARY KEY ("benefitId","campusId")
);

-- CreateTable
CREATE TABLE "recalc_admin"."admin_price_override" (
    "id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "targetKeys" JSONB NOT NULL,
    "newPrice" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_price_override_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."admin_canonical_alias" (
    "id" UUID NOT NULL,
    "aliasType" TEXT NOT NULL,
    "canonicalValue" TEXT NOT NULL,
    "canonicalNormalized" TEXT NOT NULL,
    "aliasValue" TEXT NOT NULL,
    "aliasNormalized" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_canonical_alias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."admin_public_cta" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "recalc_admin"."AdminPublicCtaKind" NOT NULL,
    "location" "recalc_admin"."AdminPublicCtaLocation" NOT NULL DEFAULT 'HOME_PRIMARY',
    "placementPage" "recalc_admin"."AdminPlacementPage" NOT NULL DEFAULT 'public_home',
    "placementSection" "recalc_admin"."AdminPlacementSection" NOT NULL DEFAULT 'hero',
    "placementPanel" "recalc_admin"."AdminPlacementPanel" NOT NULL DEFAULT 'primary',
    "placementSlot" "recalc_admin"."AdminPlacementSlot" NOT NULL DEFAULT 'primary',
    "placementBreakpoint" "recalc_admin"."AdminPlacementBreakpoint" NOT NULL DEFAULT 'all',
    "placementOrder" INTEGER NOT NULL DEFAULT 0,
    "url" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "variant" TEXT,
    "organizationId" UUID,
    "onlyNewUsers" BOOLEAN NOT NULL DEFAULT false,
    "requiredCapability" "recalc_admin"."UserCapability",
    "visibilityRule" JSONB,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_public_cta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."admin_announcement" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "display" "recalc_admin"."AdminAnnouncementDisplay" NOT NULL DEFAULT 'banner',
    "location" "recalc_admin"."AdminPublicCtaLocation" NOT NULL DEFAULT 'HOME_PRIMARY',
    "placementPage" "recalc_admin"."AdminPlacementPage" NOT NULL DEFAULT 'public_home',
    "placementSection" "recalc_admin"."AdminPlacementSection" NOT NULL DEFAULT 'hero',
    "placementPanel" "recalc_admin"."AdminPlacementPanel" NOT NULL DEFAULT 'primary',
    "placementSlot" "recalc_admin"."AdminPlacementSlot" NOT NULL DEFAULT 'primary',
    "placementBreakpoint" "recalc_admin"."AdminPlacementBreakpoint" NOT NULL DEFAULT 'all',
    "placementOrder" INTEGER NOT NULL DEFAULT 0,
    "organizationId" UUID,
    "onlyNewUsers" BOOLEAN NOT NULL DEFAULT false,
    "url" TEXT,
    "buttonLabel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "variant" TEXT,
    "visibilityRule" JSONB,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."admin_sidebar_info" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_sidebar_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."admin_audit_log" (
    "id" UUID NOT NULL,
    "module" "recalc_admin"."AdminConfigModule" NOT NULL,
    "action" "recalc_admin"."AdminAuditAction" NOT NULL,
    "source" "recalc_admin"."AdminChangeSource" NOT NULL DEFAULT 'UI',
    "actorUserId" UUID,
    "actorEmail" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "requestId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "diffSummary" JSONB,
    "message" TEXT,
    "importSessionId" UUID,
    "versionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."auto_audit_run" (
    "id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "mode" TEXT NOT NULL DEFAULT 'standard',
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "ref" TEXT NOT NULL DEFAULT 'main',
    "head_sha" TEXT,
    "workflow_run_id" TEXT,
    "workflow_run_url" TEXT,
    "artifact_name" TEXT,
    "report_summary" JSONB,
    "report_markdown" TEXT,
    "error" TEXT,
    "created_by_user_id" UUID,
    "created_by_email" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_audit_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."auto_audit_finding" (
    "id" UUID NOT NULL,
    "audit_run_id" UUID NOT NULL,
    "check_id" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "file_path" TEXT,
    "line" INTEGER,
    "suggested_action" TEXT,
    "repairable" BOOLEAN NOT NULL DEFAULT false,
    "raw" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auto_audit_finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."auto_repair_run" (
    "id" UUID NOT NULL,
    "audit_run_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "workflow_run_id" TEXT,
    "workflow_run_url" TEXT,
    "branch_name" TEXT NOT NULL,
    "commit_sha" TEXT,
    "pull_request_number" INTEGER,
    "pull_request_url" TEXT,
    "selected_finding_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "error" TEXT,
    "created_by_user_id" UUID,
    "created_by_email" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_repair_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."TrainingRoom" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scenario" TEXT,
    "visibility" "recalc_admin"."TrainingRoomVisibility" NOT NULL DEFAULT 'org',
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."TrainingRoomMember" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "recalc_admin"."TrainingRoomRole" NOT NULL DEFAULT 'participant',
    "accessRole" "recalc_admin"."TrainingAccessRole" NOT NULL DEFAULT 'user',
    "isAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "anonymousAlias" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingRoomMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."TrainingMessage" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "chatId" UUID,
    "userId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."training_chat" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "title" TEXT,
    "status" "recalc_admin"."TrainingChatStatus" NOT NULL DEFAULT 'open',
    "createdBy" UUID NOT NULL,
    "closedAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."training_chat_participant" (
    "id" UUID NOT NULL,
    "chatId" UUID NOT NULL,
    "roomMemberId" UUID,
    "userId" UUID NOT NULL,
    "role" "recalc_admin"."TrainingAccessRole" NOT NULL DEFAULT 'user',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_chat_participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."training_feedback" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "chatId" UUID NOT NULL,
    "authorUserId" UUID NOT NULL,
    "targetUserId" UUID NOT NULL,
    "rating" INTEGER,
    "summary" TEXT NOT NULL,
    "strengths" TEXT,
    "improvements" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."TrainingRoomPermission" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "canViewRolplay" BOOLEAN NOT NULL DEFAULT false,
    "canJoinRolplay" BOOLEAN NOT NULL DEFAULT false,
    "canCreateRoom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingRoomPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."admin_config_version" (
    "id" UUID NOT NULL,
    "module" "recalc_admin"."AdminConfigModule" NOT NULL,
    "source" "recalc_admin"."AdminChangeSource" NOT NULL DEFAULT 'UI',
    "snapshot" JSONB NOT NULL,
    "diffSummary" JSONB,
    "summary" JSONB,
    "notes" TEXT,
    "createdByUserId" UUID,
    "createdByEmail" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedByUserId" UUID,
    "publishedByEmail" TEXT,
    "importSessionId" UUID,
    "restoredFromVersionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_config_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."admin_published_config" (
    "module" "recalc_admin"."AdminConfigModule" NOT NULL,
    "versionId" UUID NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" UUID,
    "updatedByEmail" TEXT,

    CONSTRAINT "admin_published_config_pkey" PRIMARY KEY ("module")
);

-- CreateTable
CREATE TABLE "recalc_admin"."admin_import_session" (
    "id" UUID NOT NULL,
    "module" "recalc_admin"."AdminConfigModule" NOT NULL,
    "status" "recalc_admin"."AdminImportSessionStatus" NOT NULL DEFAULT 'preview',
    "source" "recalc_admin"."AdminChangeSource" NOT NULL DEFAULT 'IMPORT',
    "fileName" TEXT,
    "fileChecksum" TEXT,
    "preview" JSONB,
    "payload" JSONB,
    "warnings" JSONB,
    "errors" JSONB,
    "result" JSONB,
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB,
    "summary" JSONB,
    "createdByUserId" UUID,
    "createdByEmail" TEXT,
    "appliedByUserId" UUID,
    "appliedByEmail" TEXT,
    "appliedVersionId" UUID,
    "rolledBackVersionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),

    CONSTRAINT "admin_import_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."organization" (
    "id" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."organization_member" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "recalc_admin"."OrgRole" NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."inbox_thread" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "subject" TEXT,
    "status" "recalc_admin"."InboxThreadStatus" NOT NULL DEFAULT 'active',
    "createdBy" UUID NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbox_thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."inbox_thread_participant" (
    "id" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbox_thread_participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."inbox_message" (
    "id" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbox_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."academic_fee" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "costMxn" INTEGER NOT NULL,
    "section" "recalc_admin"."AcademicFeeSection" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_fee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."campus_academic_fee" (
    "id" UUID NOT NULL,
    "campusId" UUID NOT NULL,
    "academicFeeId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "overrideCostMxn" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campus_academic_fee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."scholarship_rule" (
    "id" UUID NOT NULL,
    "enrollmentType" "recalc_admin"."EnrollmentType" NOT NULL,
    "businessLine" "recalc_admin"."BenefitBusinessLine" NOT NULL,
    "modality" "recalc_admin"."CanonicalModality" NOT NULL,
    "plan" INTEGER NOT NULL,
    "campusTier" TEXT NOT NULL DEFAULT 'ANY',
    "region" TEXT NOT NULL DEFAULT '',
    "plantel" TEXT NOT NULL DEFAULT '',
    "programaKey" TEXT NOT NULL DEFAULT '',
    "minAverage" DECIMAL(4,2),
    "maxAverage" DECIMAL(4,2),
    "scholarshipPercent" DECIMAL(5,2),
    "discountedPriceMxn" DECIMAL(12,2),
    "origin" TEXT,
    "sourceVersion" TEXT NOT NULL DEFAULT 'canonical',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scholarship_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recalc_admin"."return_subject_price" (
    "id" UUID NOT NULL,
    "campusId" UUID NOT NULL,
    "modality" "recalc_admin"."CanonicalModality" NOT NULL,
    "subjectCount" INTEGER NOT NULL,
    "priceMxn" DECIMAL(12,2) NOT NULL,
    "sourceVersion" TEXT NOT NULL DEFAULT 'canonical',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "return_subject_price_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campus_code_key" ON "recalc_admin"."campus"("code");

-- CreateIndex
CREATE UNIQUE INDEX "campus_metaKey_key" ON "recalc_admin"."campus"("metaKey");

-- CreateIndex
CREATE UNIQUE INDEX "campus_slug_key" ON "recalc_admin"."campus"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "program_nameNormalized_key" ON "recalc_admin"."program"("nameNormalized");

-- CreateIndex
CREATE INDEX "enrollment_format_active_sort_idx" ON "recalc_admin"."enrollment_format"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "quote_session_publicId_key" ON "recalc_admin"."quote_session"("publicId");

-- CreateIndex
CREATE INDEX "quote_session_owner_updated_idx" ON "recalc_admin"."quote_session"("ownerUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "quote_scenario_session_kind_updated_idx" ON "recalc_admin"."quote_scenario"("quoteSessionId", "kind", "updatedAt");

-- CreateIndex
CREATE INDEX "quote_scenario_campus_updated_idx" ON "recalc_admin"."quote_scenario"("campusId", "updatedAt");

-- CreateIndex
CREATE INDEX "quote_scenario_program_updated_idx" ON "recalc_admin"."quote_scenario"("programId", "updatedAt");

-- CreateIndex
CREATE INDEX "quote_scenario_fingerprint_idx" ON "recalc_admin"."quote_scenario"("inputFingerprint");

-- CreateIndex
CREATE INDEX "business_event_type_created_idx" ON "recalc_admin"."business_event"("type", "createdAt");

-- CreateIndex
CREATE INDEX "business_event_session_created_idx" ON "recalc_admin"."business_event"("quoteSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "business_event_scenario_created_idx" ON "recalc_admin"."business_event"("quoteScenarioId", "createdAt");

-- CreateIndex
CREATE INDEX "business_event_subject_created_idx" ON "recalc_admin"."business_event"("subjectType", "subjectId", "createdAt");

-- CreateIndex
CREATE INDEX "business_event_user_created_idx" ON "recalc_admin"."business_event"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "program_asset_check_status_checked_idx" ON "recalc_admin"."program_asset_check"("status", "checkedAt");

-- CreateIndex
CREATE UNIQUE INDEX "program_asset_check_program_asset_type_key" ON "recalc_admin"."program_asset_check"("programId", "assetType");

-- CreateIndex
CREATE INDEX "program_offering_campusId_cycle_idx" ON "recalc_admin"."program_offering"("campusId", "cycle");

-- CreateIndex
CREATE INDEX "program_offering_cycle_isActive_idx" ON "recalc_admin"."program_offering"("cycle", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "program_offering_campusId_programId_cycle_track_key" ON "recalc_admin"."program_offering"("campusId", "programId", "cycle", "track");

-- CreateIndex
CREATE INDEX "directory_contact_campus_role_idx" ON "recalc_admin"."directory_contact"("campusId", "role");

-- CreateIndex
CREATE INDEX "directory_contact_method_contact_sort_idx" ON "recalc_admin"."directory_contact_method"("directoryContactId", "sortOrder");

-- CreateIndex
CREATE INDEX "directory_contact_method_type_normalized_idx" ON "recalc_admin"."directory_contact_method"("type", "normalizedValue");

-- CreateIndex
CREATE UNIQUE INDEX "directory_contact_method_unique_value_idx" ON "recalc_admin"."directory_contact_method"("directoryContactId", "type", "normalizedValue");

-- CreateIndex
CREATE INDEX "bulletin_campus_cycle_idx" ON "recalc_admin"."bulletin"("campusId", "cycle");

-- CreateIndex
CREATE UNIQUE INDEX "user_authUserId_key" ON "recalc_admin"."user"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "recalc_admin"."user"("email");

-- CreateIndex
CREATE INDEX "user_role_isActive_idx" ON "recalc_admin"."user"("role", "isActive");

-- CreateIndex
CREATE INDEX "user_agenda_item_user_status_updated_idx" ON "recalc_admin"."user_agenda_item"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "user_agenda_item_user_type_updated_idx" ON "recalc_admin"."user_agenda_item"("userId", "type", "updatedAt");

-- CreateIndex
CREATE INDEX "user_contact_owner_updated_idx" ON "recalc_admin"."user_contact"("ownerUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "user_contact_owner_session_idx" ON "recalc_admin"."user_contact"("ownerUserId", "assignedQuoteSessionPublicId");

-- CreateIndex
CREATE INDEX "user_contact_owner_identity_sync_idx" ON "recalc_admin"."user_contact"("ownerUserId", "lastIdentitySyncAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_contact_owner_phone_key" ON "recalc_admin"."user_contact"("ownerUserId", "normalizedPhone");

-- CreateIndex
CREATE UNIQUE INDEX "user_contact_owner_waid_key" ON "recalc_admin"."user_contact"("ownerUserId", "waId");

-- CreateIndex
CREATE UNIQUE INDEX "user_contact_owner_bsuid_key" ON "recalc_admin"."user_contact"("ownerUserId", "bsuid");

-- CreateIndex
CREATE INDEX "extension_campaign_owner_updated_idx" ON "recalc_admin"."extension_campaign"("ownerUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "extension_campaign_status_schedule_idx" ON "recalc_admin"."extension_campaign"("status", "scheduleAt");

-- CreateIndex
CREATE INDEX "extension_campaign_recipient_claim_idx" ON "recalc_admin"."extension_campaign_recipient"("campaignId", "status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "extension_campaign_recipient_campaign_contact_key" ON "recalc_admin"."extension_campaign_recipient"("campaignId", "contactValue");

-- CreateIndex
CREATE UNIQUE INDEX "extension_session_token_tokenHash_key" ON "recalc_admin"."extension_session_token"("tokenHash");

-- CreateIndex
CREATE INDEX "extension_session_token_user_valid_idx" ON "recalc_admin"."extension_session_token"("userId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "extension_session_token_expires_idx" ON "recalc_admin"."extension_session_token"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_google_connection_userId_key" ON "recalc_admin"."user_google_connection"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_push_subscription_endpoint_key" ON "recalc_admin"."user_push_subscription"("endpoint");

-- CreateIndex
CREATE INDEX "user_push_subscription_user_updated_idx" ON "recalc_admin"."user_push_subscription"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_meta_whatsapp_connection_userId_key" ON "recalc_admin"."user_meta_whatsapp_connection"("userId");

-- CreateIndex
CREATE INDEX "user_meta_whatsapp_connection_status_updated_idx" ON "recalc_admin"."user_meta_whatsapp_connection"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "user_meta_whatsapp_connection_waba_idx" ON "recalc_admin"."user_meta_whatsapp_connection"("wabaId");

-- CreateIndex
CREATE INDEX "user_meta_whatsapp_connection_phone_idx" ON "recalc_admin"."user_meta_whatsapp_connection"("phoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "meta_embedded_signup_session_clientSessionId_key" ON "recalc_admin"."meta_embedded_signup_session"("clientSessionId");

-- CreateIndex
CREATE INDEX "meta_embedded_signup_session_owner_created_idx" ON "recalc_admin"."meta_embedded_signup_session"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "meta_embedded_signup_session_connection_created_idx" ON "recalc_admin"."meta_embedded_signup_session"("connectionId", "createdAt");

-- CreateIndex
CREATE INDEX "meta_embedded_signup_session_owner_status_updated_idx" ON "recalc_admin"."meta_embedded_signup_session"("ownerUserId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "meta_whatsapp_message_owner_created_idx" ON "recalc_admin"."meta_whatsapp_message"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "meta_whatsapp_message_connection_created_idx" ON "recalc_admin"."meta_whatsapp_message"("connectionId", "createdAt");

-- CreateIndex
CREATE INDEX "meta_whatsapp_message_contact_created_idx" ON "recalc_admin"."meta_whatsapp_message"("contactId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "meta_whatsapp_message_owner_meta_message_key" ON "recalc_admin"."meta_whatsapp_message"("ownerUserId", "metaMessageId");

-- CreateIndex
CREATE INDEX "meta_whatsapp_message_event_owner_event_idx" ON "recalc_admin"."meta_whatsapp_message_event"("ownerUserId", "eventAt");

-- CreateIndex
CREATE INDEX "meta_whatsapp_message_event_connection_event_idx" ON "recalc_admin"."meta_whatsapp_message_event"("connectionId", "eventAt");

-- CreateIndex
CREATE INDEX "meta_whatsapp_message_event_contact_event_idx" ON "recalc_admin"."meta_whatsapp_message_event"("contactId", "eventAt");

-- CreateIndex
CREATE INDEX "meta_whatsapp_message_event_meta_message_idx" ON "recalc_admin"."meta_whatsapp_message_event"("metaMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "agenda_sync_preference_userId_key" ON "recalc_admin"."agenda_sync_preference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "agenda_sync_preference_googleConnectionId_key" ON "recalc_admin"."agenda_sync_preference"("googleConnectionId");

-- CreateIndex
CREATE INDEX "agenda_external_sync_provider_target_idx" ON "recalc_admin"."agenda_external_sync"("provider", "targetKind", "syncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "agenda_external_sync_item_provider_target_key" ON "recalc_admin"."agenda_external_sync"("agendaItemId", "provider", "targetKind");

-- CreateIndex
CREATE INDEX "admin_user_capability_capability_enabled_idx" ON "recalc_admin"."admin_user_capability"("capability", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "admin_user_capability_user_capability_key" ON "recalc_admin"."admin_user_capability"("userId", "capability");

-- CreateIndex
CREATE INDEX "user_capability_assignment_capability_idx" ON "recalc_admin"."user_capability_assignment"("capability");

-- CreateIndex
CREATE UNIQUE INDEX "user_capability_assignment_user_capability_key" ON "recalc_admin"."user_capability_assignment"("userId", "capability");

-- CreateIndex
CREATE INDEX "admin_ui_preference_module_updated_idx" ON "recalc_admin"."admin_ui_preference"("module", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "admin_ui_preference_user_module_key" ON "recalc_admin"."admin_ui_preference"("userId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_template_systemKey_key" ON "recalc_admin"."whatsapp_template"("systemKey");

-- CreateIndex
CREATE INDEX "whatsapp_template_status_updated_idx" ON "recalc_admin"."whatsapp_template"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "whatsapp_template_owner_updated_idx" ON "recalc_admin"."whatsapp_template"("ownerUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "whatsapp_template_source_idx" ON "recalc_admin"."whatsapp_template"("sourceTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_template_preference_userId_key" ON "recalc_admin"."whatsapp_template_preference"("userId");

-- CreateIndex
CREATE INDEX "whatsapp_template_preference_active_idx" ON "recalc_admin"."whatsapp_template_preference"("activeTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "invite_tokenHash_key" ON "recalc_admin"."invite"("tokenHash");

-- CreateIndex
CREATE INDEX "invite_email_used_expires_idx" ON "recalc_admin"."invite"("email", "usedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "invite_creator_created_idx" ON "recalc_admin"."invite"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "invite_organization_idx" ON "recalc_admin"."invite"("organizationId");

-- CreateIndex
CREATE INDEX "admin_canonical_alias_type_canonical_active_idx" ON "recalc_admin"."admin_canonical_alias"("aliasType", "canonicalNormalized", "isActive");

-- CreateIndex
CREATE INDEX "admin_canonical_alias_type_active_idx" ON "recalc_admin"."admin_canonical_alias"("aliasType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "admin_canonical_alias_type_alias_key" ON "recalc_admin"."admin_canonical_alias"("aliasType", "aliasNormalized");

-- CreateIndex
CREATE INDEX "admin_public_cta_location_sortOrder_idx" ON "recalc_admin"."admin_public_cta"("location", "sortOrder");

-- CreateIndex
CREATE INDEX "admin_public_cta_placement_idx" ON "recalc_admin"."admin_public_cta"("placementPage", "placementSection", "placementPanel", "placementSlot", "placementBreakpoint", "placementOrder");

-- CreateIndex
CREATE INDEX "admin_public_cta_organization_idx" ON "recalc_admin"."admin_public_cta"("organizationId");

-- CreateIndex
CREATE INDEX "admin_announcement_location_sortOrder_idx" ON "recalc_admin"."admin_announcement"("location", "sortOrder");

-- CreateIndex
CREATE INDEX "admin_announcement_placement_idx" ON "recalc_admin"."admin_announcement"("placementPage", "placementSection", "placementPanel", "placementSlot", "placementBreakpoint", "placementOrder");

-- CreateIndex
CREATE INDEX "admin_announcement_organization_idx" ON "recalc_admin"."admin_announcement"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sidebar_info_key_key" ON "recalc_admin"."admin_sidebar_info"("key");

-- CreateIndex
CREATE INDEX "admin_audit_log_module_created_idx" ON "recalc_admin"."admin_audit_log"("module", "createdAt");

-- CreateIndex
CREATE INDEX "admin_audit_log_actor_created_idx" ON "recalc_admin"."admin_audit_log"("actorEmail", "createdAt");

-- CreateIndex
CREATE INDEX "admin_audit_log_request_idx" ON "recalc_admin"."admin_audit_log"("requestId");

-- CreateIndex
CREATE INDEX "auto_audit_run_status_created_idx" ON "recalc_admin"."auto_audit_run"("status", "created_at");

-- CreateIndex
CREATE INDEX "auto_audit_run_actor_created_idx" ON "recalc_admin"."auto_audit_run"("created_by_email", "created_at");

-- CreateIndex
CREATE INDEX "auto_audit_run_workflow_run_idx" ON "recalc_admin"."auto_audit_run"("workflow_run_id");

-- CreateIndex
CREATE INDEX "auto_audit_finding_run_severity_idx" ON "recalc_admin"."auto_audit_finding"("audit_run_id", "severity");

-- CreateIndex
CREATE INDEX "auto_audit_finding_check_idx" ON "recalc_admin"."auto_audit_finding"("check_id");

-- CreateIndex
CREATE INDEX "auto_audit_finding_domain_severity_idx" ON "recalc_admin"."auto_audit_finding"("domain", "severity");

-- CreateIndex
CREATE INDEX "auto_repair_run_audit_created_idx" ON "recalc_admin"."auto_repair_run"("audit_run_id", "created_at");

-- CreateIndex
CREATE INDEX "auto_repair_run_status_created_idx" ON "recalc_admin"."auto_repair_run"("status", "created_at");

-- CreateIndex
CREATE INDEX "auto_repair_run_workflow_run_idx" ON "recalc_admin"."auto_repair_run"("workflow_run_id");

-- CreateIndex
CREATE INDEX "TrainingRoom_organizationId_idx" ON "recalc_admin"."TrainingRoom"("organizationId");

-- CreateIndex
CREATE INDEX "TrainingRoom_createdBy_idx" ON "recalc_admin"."TrainingRoom"("createdBy");

-- CreateIndex
CREATE INDEX "TrainingRoom_createdAt_idx" ON "recalc_admin"."TrainingRoom"("createdAt");

-- CreateIndex
CREATE INDEX "TrainingRoomMember_roomId_idx" ON "recalc_admin"."TrainingRoomMember"("roomId");

-- CreateIndex
CREATE INDEX "TrainingRoomMember_userId_idx" ON "recalc_admin"."TrainingRoomMember"("userId");

-- CreateIndex
CREATE INDEX "TrainingRoomMember_joinedAt_idx" ON "recalc_admin"."TrainingRoomMember"("joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingRoomMember_roomId_userId_key" ON "recalc_admin"."TrainingRoomMember"("roomId", "userId");

-- CreateIndex
CREATE INDEX "TrainingMessage_roomId_idx" ON "recalc_admin"."TrainingMessage"("roomId");

-- CreateIndex
CREATE INDEX "TrainingMessage_chatId_idx" ON "recalc_admin"."TrainingMessage"("chatId");

-- CreateIndex
CREATE INDEX "TrainingMessage_userId_idx" ON "recalc_admin"."TrainingMessage"("userId");

-- CreateIndex
CREATE INDEX "TrainingMessage_createdAt_idx" ON "recalc_admin"."TrainingMessage"("createdAt");

-- CreateIndex
CREATE INDEX "training_chat_room_updated_idx" ON "recalc_admin"."training_chat"("roomId", "updatedAt");

-- CreateIndex
CREATE INDEX "training_chat_status_last_message_idx" ON "recalc_admin"."training_chat"("status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "training_chat_participant_room_member_idx" ON "recalc_admin"."training_chat_participant"("roomMemberId");

-- CreateIndex
CREATE INDEX "training_chat_participant_user_joined_idx" ON "recalc_admin"."training_chat_participant"("userId", "joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "training_chat_participant_chatId_userId_key" ON "recalc_admin"."training_chat_participant"("chatId", "userId");

-- CreateIndex
CREATE INDEX "training_feedback_chat_created_idx" ON "recalc_admin"."training_feedback"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "training_feedback_target_created_idx" ON "recalc_admin"."training_feedback"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "TrainingRoomPermission_userId_idx" ON "recalc_admin"."TrainingRoomPermission"("userId");

-- CreateIndex
CREATE INDEX "TrainingRoomPermission_organizationId_idx" ON "recalc_admin"."TrainingRoomPermission"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingRoomPermission_userId_organizationId_key" ON "recalc_admin"."TrainingRoomPermission"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "admin_config_version_module_created_idx" ON "recalc_admin"."admin_config_version"("module", "createdAt");

-- CreateIndex
CREATE INDEX "admin_config_version_module_published_idx" ON "recalc_admin"."admin_config_version"("module", "publishedAt");

-- CreateIndex
CREATE INDEX "admin_config_version_import_session_idx" ON "recalc_admin"."admin_config_version"("importSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_published_config_versionId_key" ON "recalc_admin"."admin_published_config"("versionId");

-- CreateIndex
CREATE INDEX "admin_import_session_module_status_created_idx" ON "recalc_admin"."admin_import_session"("module", "status", "createdAt");

-- CreateIndex
CREATE INDEX "admin_import_session_creator_created_idx" ON "recalc_admin"."admin_import_session"("createdByEmail", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "organization_member_organizationId_userId_key" ON "recalc_admin"."organization_member"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "inbox_thread_org_updated_idx" ON "recalc_admin"."inbox_thread"("organizationId", "updatedAt");

-- CreateIndex
CREATE INDEX "inbox_thread_status_last_message_idx" ON "recalc_admin"."inbox_thread"("status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "inbox_thread_participant_user_updated_idx" ON "recalc_admin"."inbox_thread_participant"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "inbox_thread_participant_threadId_userId_key" ON "recalc_admin"."inbox_thread_participant"("threadId", "userId");

-- CreateIndex
CREATE INDEX "inbox_message_thread_created_idx" ON "recalc_admin"."inbox_message"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "inbox_message_user_created_idx" ON "recalc_admin"."inbox_message"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "academic_fee_code_key" ON "recalc_admin"."academic_fee"("code");

-- CreateIndex
CREATE INDEX "campus_academic_fee_campusId_idx" ON "recalc_admin"."campus_academic_fee"("campusId");

-- CreateIndex
CREATE UNIQUE INDEX "campus_academic_fee_campusId_academicFeeId_key" ON "recalc_admin"."campus_academic_fee"("campusId", "academicFeeId");

-- CreateIndex
CREATE INDEX "scholarship_rule_lookup_idx" ON "recalc_admin"."scholarship_rule"("businessLine", "modality", "plan");

-- CreateIndex
CREATE INDEX "scholarship_rule_source_enrollment_idx" ON "recalc_admin"."scholarship_rule"("sourceVersion", "enrollmentType");

-- CreateIndex
CREATE INDEX "scholarship_rule_programa_key_idx" ON "recalc_admin"."scholarship_rule"("programaKey");

-- CreateIndex
CREATE INDEX "scholarship_rule_plantel_idx" ON "recalc_admin"."scholarship_rule"("plantel");

-- CreateIndex
CREATE UNIQUE INDEX "scholarship_rule_runtime_scope_key" ON "recalc_admin"."scholarship_rule"("enrollmentType", "businessLine", "modality", "plan", "campusTier", "region", "plantel", "programaKey", "minAverage", "maxAverage", "sourceVersion");

-- CreateIndex
CREATE INDEX "return_subject_price_lookup_idx" ON "recalc_admin"."return_subject_price"("campusId", "modality");

-- CreateIndex
CREATE UNIQUE INDEX "return_subject_price_runtime_key" ON "recalc_admin"."return_subject_price"("campusId", "modality", "subjectCount", "sourceVersion");

-- AddForeignKey
ALTER TABLE "recalc_admin"."quote_session" ADD CONSTRAINT "quote_session_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."quote_scenario" ADD CONSTRAINT "quote_scenario_quoteSessionId_fkey" FOREIGN KEY ("quoteSessionId") REFERENCES "recalc_admin"."quote_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."quote_scenario" ADD CONSTRAINT "quote_scenario_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "recalc_admin"."campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."quote_scenario" ADD CONSTRAINT "quote_scenario_programId_fkey" FOREIGN KEY ("programId") REFERENCES "recalc_admin"."program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."business_event" ADD CONSTRAINT "business_event_quoteSessionId_fkey" FOREIGN KEY ("quoteSessionId") REFERENCES "recalc_admin"."quote_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."business_event" ADD CONSTRAINT "business_event_quoteScenarioId_fkey" FOREIGN KEY ("quoteScenarioId") REFERENCES "recalc_admin"."quote_scenario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."program_asset_check" ADD CONSTRAINT "program_asset_check_programId_fkey" FOREIGN KEY ("programId") REFERENCES "recalc_admin"."program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."program_offering" ADD CONSTRAINT "program_offering_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "recalc_admin"."campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."program_offering" ADD CONSTRAINT "program_offering_programId_fkey" FOREIGN KEY ("programId") REFERENCES "recalc_admin"."program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."directory_contact" ADD CONSTRAINT "directory_contact_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "recalc_admin"."campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."directory_contact_method" ADD CONSTRAINT "directory_contact_method_directoryContactId_fkey" FOREIGN KEY ("directoryContactId") REFERENCES "recalc_admin"."directory_contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."bulletin" ADD CONSTRAINT "bulletin_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "recalc_admin"."campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."user_agenda_item" ADD CONSTRAINT "user_agenda_item_userId_fkey" FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."user_contact" ADD CONSTRAINT "user_contact_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."extension_campaign" ADD CONSTRAINT "extension_campaign_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."extension_campaign_recipient" ADD CONSTRAINT "extension_campaign_recipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "recalc_admin"."extension_campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."extension_session_token" ADD CONSTRAINT "extension_session_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."user_google_connection" ADD CONSTRAINT "user_google_connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."user_push_subscription" ADD CONSTRAINT "user_push_subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."user_meta_whatsapp_connection" ADD CONSTRAINT "user_meta_whatsapp_connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."meta_embedded_signup_session" ADD CONSTRAINT "meta_embedded_signup_session_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."meta_embedded_signup_session" ADD CONSTRAINT "meta_embedded_signup_session_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "recalc_admin"."user_meta_whatsapp_connection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."meta_whatsapp_message" ADD CONSTRAINT "meta_whatsapp_message_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."meta_whatsapp_message" ADD CONSTRAINT "meta_whatsapp_message_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "recalc_admin"."user_meta_whatsapp_connection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."meta_whatsapp_message" ADD CONSTRAINT "meta_whatsapp_message_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "recalc_admin"."user_contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."meta_whatsapp_message_event" ADD CONSTRAINT "meta_whatsapp_message_event_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."meta_whatsapp_message_event" ADD CONSTRAINT "meta_whatsapp_message_event_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "recalc_admin"."user_meta_whatsapp_connection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."meta_whatsapp_message_event" ADD CONSTRAINT "meta_whatsapp_message_event_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "recalc_admin"."user_contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."meta_whatsapp_message_event" ADD CONSTRAINT "meta_whatsapp_message_event_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "recalc_admin"."meta_whatsapp_message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."agenda_sync_preference" ADD CONSTRAINT "agenda_sync_preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."agenda_sync_preference" ADD CONSTRAINT "agenda_sync_preference_googleConnectionId_fkey" FOREIGN KEY ("googleConnectionId") REFERENCES "recalc_admin"."user_google_connection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."agenda_external_sync" ADD CONSTRAINT "agenda_external_sync_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "recalc_admin"."user_agenda_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."admin_user_capability" ADD CONSTRAINT "admin_user_capability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."user_capability_assignment" ADD CONSTRAINT "user_capability_assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."admin_ui_preference" ADD CONSTRAINT "admin_ui_preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."whatsapp_template" ADD CONSTRAINT "whatsapp_template_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."whatsapp_template" ADD CONSTRAINT "whatsapp_template_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "recalc_admin"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."whatsapp_template" ADD CONSTRAINT "whatsapp_template_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "recalc_admin"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."whatsapp_template" ADD CONSTRAINT "whatsapp_template_sourceTemplateId_fkey" FOREIGN KEY ("sourceTemplateId") REFERENCES "recalc_admin"."whatsapp_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."whatsapp_template_preference" ADD CONSTRAINT "whatsapp_template_preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."whatsapp_template_preference" ADD CONSTRAINT "whatsapp_template_preference_activeTemplateId_fkey" FOREIGN KEY ("activeTemplateId") REFERENCES "recalc_admin"."whatsapp_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."invite" ADD CONSTRAINT "invite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "recalc_admin"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."invite" ADD CONSTRAINT "invite_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "recalc_admin"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."invite" ADD CONSTRAINT "invite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "recalc_admin"."organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."admin_additional_benefit_campus" ADD CONSTRAINT "admin_additional_benefit_campus_benefitId_fkey" FOREIGN KEY ("benefitId") REFERENCES "recalc_admin"."admin_additional_benefit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."admin_additional_benefit_campus" ADD CONSTRAINT "admin_additional_benefit_campus_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "recalc_admin"."campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."admin_public_cta" ADD CONSTRAINT "admin_public_cta_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "recalc_admin"."organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."admin_announcement" ADD CONSTRAINT "admin_announcement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "recalc_admin"."organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."auto_audit_finding" ADD CONSTRAINT "auto_audit_finding_audit_run_id_fkey" FOREIGN KEY ("audit_run_id") REFERENCES "recalc_admin"."auto_audit_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."auto_repair_run" ADD CONSTRAINT "auto_repair_run_audit_run_id_fkey" FOREIGN KEY ("audit_run_id") REFERENCES "recalc_admin"."auto_audit_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."TrainingRoom" ADD CONSTRAINT "TrainingRoom_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "recalc_admin"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."TrainingRoom" ADD CONSTRAINT "TrainingRoom_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "recalc_admin"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."TrainingRoomMember" ADD CONSTRAINT "TrainingRoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "recalc_admin"."TrainingRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."TrainingRoomMember" ADD CONSTRAINT "TrainingRoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."TrainingMessage" ADD CONSTRAINT "TrainingMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "recalc_admin"."TrainingRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."TrainingMessage" ADD CONSTRAINT "TrainingMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "recalc_admin"."training_chat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."TrainingMessage" ADD CONSTRAINT "TrainingMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."training_chat" ADD CONSTRAINT "training_chat_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "recalc_admin"."TrainingRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."training_chat" ADD CONSTRAINT "training_chat_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "recalc_admin"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."training_chat_participant" ADD CONSTRAINT "training_chat_participant_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "recalc_admin"."training_chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."training_chat_participant" ADD CONSTRAINT "training_chat_participant_roomMemberId_fkey" FOREIGN KEY ("roomMemberId") REFERENCES "recalc_admin"."TrainingRoomMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."training_chat_participant" ADD CONSTRAINT "training_chat_participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."training_feedback" ADD CONSTRAINT "training_feedback_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "recalc_admin"."TrainingRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."training_feedback" ADD CONSTRAINT "training_feedback_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "recalc_admin"."training_chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."training_feedback" ADD CONSTRAINT "training_feedback_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."training_feedback" ADD CONSTRAINT "training_feedback_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."TrainingRoomPermission" ADD CONSTRAINT "TrainingRoomPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."TrainingRoomPermission" ADD CONSTRAINT "TrainingRoomPermission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "recalc_admin"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."admin_published_config" ADD CONSTRAINT "admin_published_config_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "recalc_admin"."admin_config_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."organization_member" ADD CONSTRAINT "organization_member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "recalc_admin"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."organization_member" ADD CONSTRAINT "organization_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."inbox_thread" ADD CONSTRAINT "inbox_thread_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "recalc_admin"."organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."inbox_thread" ADD CONSTRAINT "inbox_thread_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "recalc_admin"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."inbox_thread_participant" ADD CONSTRAINT "inbox_thread_participant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "recalc_admin"."inbox_thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."inbox_thread_participant" ADD CONSTRAINT "inbox_thread_participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."inbox_message" ADD CONSTRAINT "inbox_message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "recalc_admin"."inbox_thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."inbox_message" ADD CONSTRAINT "inbox_message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "recalc_admin"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."campus_academic_fee" ADD CONSTRAINT "campus_academic_fee_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "recalc_admin"."campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."campus_academic_fee" ADD CONSTRAINT "campus_academic_fee_academicFeeId_fkey" FOREIGN KEY ("academicFeeId") REFERENCES "recalc_admin"."academic_fee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recalc_admin"."return_subject_price" ADD CONSTRAINT "return_subject_price_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "recalc_admin"."campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The earlier Supabase foundation migration grants authenticated access to future
-- tables in recalc_admin. Keep the Prisma-backed domain server-only by default,
-- then open only the two persisted message tables required by Realtime.
DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'campus',
    'program',
    'enrollment_format',
    'quote_session',
    'quote_scenario',
    'business_event',
    'program_asset_check',
    'program_offering',
    'directory_contact',
    'directory_contact_method',
    'bulletin',
    'user',
    'user_agenda_item',
    'user_contact',
    'extension_campaign',
    'extension_campaign_recipient',
    'extension_session_token',
    'user_google_connection',
    'user_push_subscription',
    'user_meta_whatsapp_connection',
    'meta_embedded_signup_session',
    'meta_whatsapp_message',
    'meta_whatsapp_message_event',
    'agenda_sync_preference',
    'agenda_external_sync',
    'admin_user_capability',
    'user_capability_assignment',
    'admin_ui_preference',
    'whatsapp_template',
    'whatsapp_template_preference',
    'invite',
    'admin_additional_benefit',
    'admin_additional_benefit_campus',
    'admin_price_override',
    'admin_canonical_alias',
    'admin_public_cta',
    'admin_announcement',
    'admin_sidebar_info',
    'admin_audit_log',
    'auto_audit_run',
    'auto_audit_finding',
    'auto_repair_run',
    'TrainingRoom',
    'TrainingRoomMember',
    'TrainingMessage',
    'training_chat',
    'training_chat_participant',
    'training_feedback',
    'TrainingRoomPermission',
    'admin_config_version',
    'admin_published_config',
    'admin_import_session',
    'organization',
    'organization_member',
    'inbox_thread',
    'inbox_thread_participant',
    'inbox_message',
    'academic_fee',
    'campus_academic_fee',
    'scholarship_rule',
    'return_subject_price'
  ]
  LOOP
    EXECUTE format(
      'ALTER TABLE recalc_admin.%I ENABLE ROW LEVEL SECURITY',
      target_table
    );
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE recalc_admin.%I FROM anon, authenticated',
      target_table
    );
    EXECUTE format(
      'GRANT ALL PRIVILEGES ON TABLE recalc_admin.%I TO service_role',
      target_table
    );
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA recalc_admin
  REVOKE ALL ON TABLES FROM authenticated;

-- Preserve the RLS-controlled browser access from the Supabase foundation.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  recalc_admin.profiles,
  recalc_admin.organizations,
  recalc_admin.organization_members,
  recalc_admin.roles,
  recalc_admin.permissions,
  recalc_admin.role_permissions,
  recalc_admin.file_assets,
  recalc_admin.inbox_threads,
  recalc_admin.inbox_messages,
  recalc_admin.training_rooms,
  recalc_admin.training_messages,
  recalc_admin.migration_batches
TO authenticated;

CREATE OR REPLACE FUNCTION recalc_admin.current_domain_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT app_user.id
  FROM recalc_admin."user" AS app_user
  WHERE app_user."authUserId" = (SELECT auth.uid())::text
    AND app_user."isActive" = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION recalc_admin.current_domain_user_can_read_inbox_thread(
  target_thread_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM recalc_admin.inbox_thread_participant AS participant
    WHERE participant."threadId" = target_thread_id
      AND participant."userId" = recalc_admin.current_domain_user_id()
  )
$$;

CREATE OR REPLACE FUNCTION recalc_admin.current_domain_user_can_read_training_room(
  target_room_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM recalc_admin."user" AS app_user
    JOIN recalc_admin."TrainingRoom" AS room
      ON room.id = target_room_id
    LEFT JOIN recalc_admin."TrainingRoomMember" AS room_member
      ON room_member."roomId" = room.id
     AND room_member."userId" = app_user.id
     AND room_member."leftAt" IS NULL
    LEFT JOIN recalc_admin.organization_member AS organization_member
      ON organization_member."organizationId" = room."organizationId"
     AND organization_member."userId" = app_user.id
    LEFT JOIN recalc_admin."TrainingRoomPermission" AS permission
      ON permission."organizationId" = room."organizationId"
     AND permission."userId" = app_user.id
    WHERE app_user.id = recalc_admin.current_domain_user_id()
      AND (
        app_user.role IN ('owner', 'admin_operativo')
        OR room.visibility = 'public'
        OR room."createdBy" = app_user.id
        OR room_member.id IS NOT NULL
        OR (
          room.visibility = 'org'
          AND organization_member.id IS NOT NULL
        )
        OR permission."canViewRolplay" = true
      )
  )
$$;

REVOKE ALL ON FUNCTION recalc_admin.current_domain_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION recalc_admin.current_domain_user_can_read_inbox_thread(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION recalc_admin.current_domain_user_can_read_training_room(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION recalc_admin.current_domain_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION recalc_admin.current_domain_user_can_read_inbox_thread(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION recalc_admin.current_domain_user_can_read_training_room(uuid) TO authenticated;

DROP POLICY IF EXISTS inbox_message_select_participant
  ON recalc_admin.inbox_message;
CREATE POLICY inbox_message_select_participant
ON recalc_admin.inbox_message
FOR SELECT
TO authenticated
USING (
  recalc_admin.current_domain_user_can_read_inbox_thread("threadId")
);

DROP POLICY IF EXISTS training_message_select_authorized
  ON recalc_admin."TrainingMessage";
CREATE POLICY training_message_select_authorized
ON recalc_admin."TrainingMessage"
FOR SELECT
TO authenticated
USING (
  recalc_admin.current_domain_user_can_read_training_room("roomId")
);

GRANT SELECT ON TABLE
  recalc_admin.inbox_message,
  recalc_admin."TrainingMessage"
TO authenticated;

ALTER TABLE recalc_admin.inbox_message REPLICA IDENTITY FULL;
ALTER TABLE recalc_admin."TrainingMessage" REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'recalc_admin'
        AND tablename = 'inbox_message'
    ) THEN
      ALTER PUBLICATION supabase_realtime
        ADD TABLE recalc_admin.inbox_message;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'recalc_admin'
        AND tablename = 'TrainingMessage'
    ) THEN
      ALTER PUBLICATION supabase_realtime
        ADD TABLE recalc_admin."TrainingMessage";
    END IF;
  END IF;
END $$;

COMMIT;
