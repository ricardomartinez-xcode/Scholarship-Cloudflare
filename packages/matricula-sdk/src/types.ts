export type MatriculaSdkAuth =
  | { type: "bearer"; token: string }
  | { type: "api-key"; apiKey: string; headerName?: string };

export type MatriculaSdkClientOptions = {
  baseUrl: string;
  auth?: MatriculaSdkAuth;
  timeoutMs?: number;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
  sharePath?: string;
  statusPath?: string;
  healthPath?: string;
};

export type MatriculaStudent = {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  externalId?: string;
};

export type MatriculaAcademicProgram = {
  campus?: string;
  campusCode?: string;
  region?: string;
  program?: string;
  programCode?: string;
  modality?: string;
  module?: string;
  plan?: number | string;
  cycle?: string;
  businessLine?: string;
};

export type MatriculaScholarshipSnapshot = {
  average?: number;
  scholarshipPercent?: number;
  enrollmentType?: string;
  subjectCount?: number;
  quoteId?: string;
  quoteTotal?: number;
};

export type ShareMatriculaPayload = {
  matricula: string;
  source?: string;
  student?: MatriculaStudent;
  academic?: MatriculaAcademicProgram;
  scholarship?: MatriculaScholarshipSnapshot;
  metadata?: Record<string, unknown>;
};

export type ShareMatriculaOptions = {
  idempotencyKey?: string;
  dryRun?: boolean;
  headers?: Record<string, string>;
};

export type ShareMatriculaResponse = {
  ok: boolean;
  shareId?: string;
  externalId?: string;
  status?: string;
  message?: string;
  credentialUrl?: string;
  raw?: unknown;
};

export type MatriculaShareStatusResponse = ShareMatriculaResponse;

export type MatriculaHealthResponse = {
  ok: boolean;
  status?: string;
  service?: string;
  raw?: unknown;
};
