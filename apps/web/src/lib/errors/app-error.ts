export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly status = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super("VALIDATION_ERROR", message, details, 400);
  }
}

export class AuthError extends AppError {
  constructor(message = "No autenticado") {
    super("AUTH_ERROR", message, undefined, 401);
  }
}

export class PermissionError extends AppError {
  constructor(message = "No autorizado") {
    super("PERMISSION_ERROR", message, undefined, 403);
  }
}

export class ExternalApiError extends AppError {
  constructor(message = "Error de API externa", details?: unknown) {
    super("EXTERNAL_API_ERROR", message, details, 502);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "No encontrado") {
    super("NOT_FOUND", message, undefined, 404);
  }
}

export function apiOk<T>(data: T) {
  return { ok: true as const, data };
}

export function apiError(error: AppError) {
  return {
    ok: false as const,
    error: error.name,
    code: error.code,
    message: error.message,
    details: error.details,
  };
}
