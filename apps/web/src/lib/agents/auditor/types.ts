export type AuditorSeverity = "info" | "warning" | "error" | "critical";

export type AuditorModule =
  | "system"
  | "tokens"
  | "oauth"
  | "users"
  | "offers"
  | "quote"
  | "github"
  | "security";

export type AuditorFinding = {
  id: string;
  module: AuditorModule;
  severity: AuditorSeverity;
  title: string;
  summary: string;
  evidence?: Record<string, unknown>;
  suggestedAction?: string;
  repairable: boolean;
  repairActionId?: string;
};

export type EnvPresence = {
  name: string;
  present: boolean;
};

export type EnvGroupStatus = {
  ok: boolean;
  vars: EnvPresence[];
};

export type AuditorSummary = {
  total: number;
  info: number;
  warning: number;
  error: number;
  critical: number;
  repairable: number;
};

export type AuditorDiagnosis = {
  generatedAt: string;
  durationMs: number;
  summary: AuditorSummary;
  findings: AuditorFinding[];
  env: Record<string, EnvGroupStatus>;
  architecture: {
    app: string;
    framework: string;
    auth: string;
    permissions: string;
    auditLog: string;
    rateLimit: string;
    github: string;
    training: string;
  };
};

export type AuditorRepairPlan = {
  findingId: string;
  title: string;
  impact: "low" | "medium" | "high";
  risk: "low" | "medium" | "high";
  requiresConfirmation: boolean;
  filesToTouch: string[];
  tests: string[];
  rollback: string;
  summary: string;
  canCreatePr: boolean;
};

export type AuditorRepairFile = {
  path: string;
  content: string;
};

export type GitHubIntegrationStatus = {
  configured: boolean;
  owner: string | null;
  repo: string | null;
  defaultBranch: string;
  missing: string[];
};

export type GitHubRepairPrResult = {
  branch: string;
  files: string[];
  pullRequest: {
    number: number;
    title: string;
    url: string;
    state: string;
  };
};
