export type ExtensionAuthFailureCode =
  | "invalid_credentials"
  | "auth_request_forbidden"
  | "auth_rate_limited"
  | "auth_provider_timeout"
  | "auth_provider_unavailable"
  | "auth_provider_request_failed"
  | "auth_provider_unreachable"
  | "auth_session_missing";

export type ExtensionAuthSignInFailure = {
  ok: false;
  status: 401 | 403 | 429 | 502 | 503;
  code: ExtensionAuthFailureCode;
  error: string;
};

export function classifyNeonAuthSignInFailure(
  upstreamStatus: number,
): ExtensionAuthSignInFailure {
  if (upstreamStatus === 401) {
    return {
      ok: false,
      status: 401,
      code: "invalid_credentials",
      error: "Correo o contraseña incorrectos.",
    };
  }

  if (upstreamStatus === 403) {
    return {
      ok: false,
      status: 403,
      code: "auth_request_forbidden",
      error:
        "El proveedor de autenticación rechazó la solicitud. Intenta de nuevo o contacta a soporte.",
    };
  }

  if (upstreamStatus === 429) {
    return {
      ok: false,
      status: 429,
      code: "auth_rate_limited",
      error:
        "Demasiados intentos de inicio de sesión. Intenta de nuevo en unos minutos.",
    };
  }

  if (upstreamStatus === 408 || upstreamStatus === 504) {
    return {
      ok: false,
      status: 503,
      code: "auth_provider_timeout",
      error:
        "El proveedor de autenticación tardó demasiado en responder. Intenta de nuevo en unos minutos.",
    };
  }

  if (upstreamStatus >= 500) {
    return {
      ok: false,
      status: 502,
      code: "auth_provider_unavailable",
      error:
        "El proveedor de autenticación no está disponible temporalmente. Intenta de nuevo en unos minutos.",
    };
  }

  return {
    ok: false,
    status: 502,
    code: "auth_provider_request_failed",
    error:
      "No fue posible completar la autenticación con el proveedor. Contacta a soporte si el problema persiste.",
  };
}

export function createNeonAuthUnreachableFailure(): ExtensionAuthSignInFailure {
  return {
    ok: false,
    status: 503,
    code: "auth_provider_unreachable",
    error:
      "No fue posible conectar con el proveedor de autenticación. Intenta de nuevo en unos minutos.",
  };
}

export function createNeonAuthSessionMissingFailure(): ExtensionAuthSignInFailure {
  return {
    ok: false,
    status: 502,
    code: "auth_session_missing",
    error:
      "El proveedor de autenticación no devolvió una sesión válida. Intenta de nuevo.",
  };
}
