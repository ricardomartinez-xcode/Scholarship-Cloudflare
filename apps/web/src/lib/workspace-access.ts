const WORKSPACE_WHATSAPP_ALLOWED_EMAILS = new Set(["ricardomartinez@relead.com.mx"]);

export function canAccessWorkspaceWhatsapp(email: string | null | undefined) {
  return WORKSPACE_WHATSAPP_ALLOWED_EMAILS.has(String(email ?? "").trim().toLowerCase());
}
