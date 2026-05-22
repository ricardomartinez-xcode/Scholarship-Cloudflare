import type { InboxActor } from "@relead/domain/inbox/types";

export function canAccessOrganizationInbox(actor: InboxActor, orgId: string | null) {
  return Boolean(actor.organizationId && orgId && actor.organizationId === orgId);
}
