export type MatriculaSdkErrorDetails = {
  status?: number;
  code?: string;
  payload?: unknown;
  cause?: unknown;
};

export class MatriculaSdkError extends Error {
  readonly name = "MatriculaSdkError";
  readonly status?: number;
  readonly code?: string;
  readonly payload?: unknown;
  readonly cause?: unknown;

  constructor(message: string, details: MatriculaSdkErrorDetails = {}) {
    super(message);
    this.status = details.status;
    this.code = details.code;
    this.payload = details.payload;
    this.cause = details.cause;
  }
}
