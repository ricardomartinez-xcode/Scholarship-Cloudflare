export const GOOGLE_OAUTH_DISABLED_CODE = "oauth_integrations_temporarily_disabled";

export function isGoogleOAuthTemporarilyDisabled() {
  return true;
}

export function googleOAuthDisabledPayload(message: string) {
  return {
    ok: false,
    disabled: true,
    code: GOOGLE_OAUTH_DISABLED_CODE,
    message,
  };
}
