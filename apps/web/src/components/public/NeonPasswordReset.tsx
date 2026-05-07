"use client";

import "@/lib/crypto-random-uuid-polyfill";

import {
  ForgotPasswordForm,
  NeonAuthUIProvider,
  ResetPasswordForm,
  type AuthFormClassNames,
} from "@neondatabase/auth/react/ui";
import { authClient } from "@/lib/auth/client";
import { getPublicBaseUrl } from "@/lib/public-base-url";

const formClassNames: AuthFormClassNames = {
  label: "text-sm text-slate-100",
  input:
    "w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 shadow-sm outline-none transition focus:border-[rgba(31,108,140,0.5)] focus:ring-2 focus:ring-[rgba(31,108,140,0.2)]",
  error: "text-xs text-red-200",
  button:
    "rounded-2xl px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(31,108,140,0.3)]",
  primaryButton: "bg-[#1F6C8C] text-white hover:bg-[#0F3C55]",
};

const localization = {
  EMAIL: "Correo",
  EMAIL_PLACEHOLDER: "nombre@unidep.edu.mx",
  IS_INVALID: "es inválido",
  IS_REQUIRED: "es requerido",

  FORGOT_PASSWORD_ACTION: "Enviar enlace",
  FORGOT_PASSWORD_EMAIL:
    "Si existe una cuenta, te enviamos un enlace para restablecer la contraseña.",

  INVALID_TOKEN: "Enlace inválido o expirado.",
  NEW_PASSWORD: "Nueva contraseña",
  NEW_PASSWORD_PLACEHOLDER: "Crea una contraseña",
  NEW_PASSWORD_REQUIRED: "La contraseña es requerida",
  CONFIRM_PASSWORD: "Confirmar contraseña",
  CONFIRM_PASSWORD_PLACEHOLDER: "Repite la contraseña",
  CONFIRM_PASSWORD_REQUIRED: "La confirmación es requerida",
  PASSWORDS_DO_NOT_MATCH: "Las contraseñas no coinciden",
  PASSWORD_TOO_SHORT: "La contraseña es demasiado corta",
  PASSWORD_TOO_LONG: "La contraseña es demasiado larga",
  INVALID_PASSWORD: "Contraseña inválida",
  RESET_PASSWORD_ACTION: "Restablecer contraseña",
  RESET_PASSWORD_SUCCESS: "Contraseña actualizada. Ya puedes iniciar sesión.",
} as const;

function Provider({ children }: { children: React.ReactNode }) {
  const typedAuthClient = authClient as unknown as never;

  return (
    <NeonAuthUIProvider
      authClient={typedAuthClient}
      basePath="/auth"
      baseURL={getPublicBaseUrl()}
      viewPaths={{
        SIGN_IN: "sign-in",
        FORGOT_PASSWORD: "forgot-password",
        RESET_PASSWORD: "reset-password",
      }}
      credentials={{ confirmPassword: true, forgotPassword: true }}
      localizeErrors={false}
    >
      {children}
    </NeonAuthUIProvider>
  );
}

export function NeonForgotPasswordForm() {
  return (
    <Provider>
      <ForgotPasswordForm
        localization={localization}
        classNames={formClassNames}
      />
    </Provider>
  );
}

export function NeonResetPasswordForm() {
  return (
    <Provider>
      <ResetPasswordForm localization={localization} classNames={formClassNames} />
    </Provider>
  );
}
