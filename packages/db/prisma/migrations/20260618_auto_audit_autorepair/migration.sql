CREATE TABLE IF NOT EXISTS "recalc_admin"."auto_audit_run" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  "completed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "auto_audit_run_status_created_idx"
ON "recalc_admin"."auto_audit_run"("status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "auto_audit_run_actor_created_idx"
ON "recalc_admin"."auto_audit_run"("created_by_email", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "auto_audit_run_workflow_run_idx"
ON "recalc_admin"."auto_audit_run"("workflow_run_id");

CREATE TABLE IF NOT EXISTS "recalc_admin"."auto_audit_finding" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "audit_run_id" UUID NOT NULL REFERENCES "recalc_admin"."auto_audit_run"("id") ON DELETE CASCADE,
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
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "auto_audit_finding_run_severity_idx"
ON "recalc_admin"."auto_audit_finding"("audit_run_id", "severity");

CREATE INDEX IF NOT EXISTS "auto_audit_finding_check_idx"
ON "recalc_admin"."auto_audit_finding"("check_id");

CREATE INDEX IF NOT EXISTS "auto_audit_finding_domain_severity_idx"
ON "recalc_admin"."auto_audit_finding"("domain", "severity");

CREATE TABLE IF NOT EXISTS "recalc_admin"."auto_repair_run" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "audit_run_id" UUID NOT NULL REFERENCES "recalc_admin"."auto_audit_run"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "workflow_run_id" TEXT,
  "workflow_run_url" TEXT,
  "branch_name" TEXT NOT NULL,
  "commit_sha" TEXT,
  "pull_request_number" INTEGER,
  "pull_request_url" TEXT,
  "selected_finding_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "error" TEXT,
  "created_by_user_id" UUID,
  "created_by_email" TEXT,
  "completed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "auto_repair_run_audit_created_idx"
ON "recalc_admin"."auto_repair_run"("audit_run_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "auto_repair_run_status_created_idx"
ON "recalc_admin"."auto_repair_run"("status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "auto_repair_run_workflow_run_idx"
ON "recalc_admin"."auto_repair_run"("workflow_run_id");
