import { Role, UserCapability } from "@prisma/client";

const ROLE_SET = new Set(Object.values(Role));
const USER_CAPABILITY_SET = new Set(Object.values(UserCapability));

export type TargetingVisibilityRule = {
  organizationId?: string | null;
  newUserOnly?: boolean;
  requiredCapability?: UserCapability | null;
  sessionStartOnly?: boolean;
  maxViews?: number | null;
  excludeOrganizationIds?: string[];
  excludeRoles?: Role[];
  excludeCapabilities?: UserCapability[];
  excludeUserIds?: string[];
};

export type NormalizedTargetingVisibilityRule = {
  organizationId: string | null;
  newUserOnly: boolean;
  requiredCapability: UserCapability | null;
  sessionStartOnly: boolean;
  maxViews: number | null;
  excludeOrganizationIds: string[];
  excludeRoles: Role[];
  excludeCapabilities: UserCapability[];
  excludeUserIds: string[];
};

export type TargetingVisibilityContext = {
  userId?: string | null;
  organizationIds?: string[];
  roles?: Array<Role | string>;
  newUser?: boolean;
  capabilities?: Iterable<UserCapability | string>;
};

export type VisibilityEvaluationResult = {
  visible: boolean;
  reason:
    | "allowed"
    | "missing_organization"
    | "new_user_only"
    | "missing_capability"
    | "excluded_organization"
    | "excluded_role"
    | "excluded_capability"
    | "excluded_user";
};

function toNormalizedUniqueStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function toNormalizedRoles(value: unknown): Role[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        .filter((item): item is Role => ROLE_SET.has(item as Role)),
    ),
  );
}

function isUserCapability(value: string): value is UserCapability {
  return USER_CAPABILITY_SET.has(value as UserCapability);
}

function toNormalizedCapabilities(value: unknown): UserCapability[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => String(item ?? "").trim())
        .filter((item): item is UserCapability => isUserCapability(item)),
    ),
  );
}

export function normalizeVisibilityRule(
  raw: unknown,
): NormalizedTargetingVisibilityRule {
  if (!raw || typeof raw !== "object") {
    return {
      organizationId: null,
      newUserOnly: false,
      requiredCapability: null,
      sessionStartOnly: false,
      maxViews: null,
      excludeOrganizationIds: [],
      excludeRoles: [],
      excludeCapabilities: [],
      excludeUserIds: [],
    };
  }

  const source = raw as Record<string, unknown>;
  const maxViewsRaw = source.maxViews;
  const requiredCapabilityRaw =
    typeof source.requiredCapability === "string"
      ? source.requiredCapability.trim()
      : null;
  return {
    organizationId:
      typeof source.organizationId === "string" && source.organizationId.trim()
        ? source.organizationId.trim()
        : null,
    newUserOnly: source.newUserOnly === true,
    requiredCapability:
      requiredCapabilityRaw && isUserCapability(requiredCapabilityRaw)
        ? requiredCapabilityRaw
        : null,
    sessionStartOnly: source.sessionStartOnly === true,
    maxViews:
      typeof maxViewsRaw === "number" && Number.isFinite(maxViewsRaw) && maxViewsRaw > 0
        ? Math.trunc(maxViewsRaw)
        : null,
    excludeOrganizationIds: toNormalizedUniqueStrings(source.excludeOrganizationIds),
    excludeRoles: toNormalizedRoles(source.excludeRoles),
    excludeCapabilities: toNormalizedCapabilities(source.excludeCapabilities),
    excludeUserIds: toNormalizedUniqueStrings(source.excludeUserIds),
  };
}

export function buildVisibilityRule(
  input: TargetingVisibilityRule,
): TargetingVisibilityRule {
  const rule: TargetingVisibilityRule = {};

  if (input.organizationId?.trim()) rule.organizationId = input.organizationId.trim();
  if (input.newUserOnly) rule.newUserOnly = true;
  if (input.requiredCapability && isUserCapability(input.requiredCapability)) {
    rule.requiredCapability = input.requiredCapability;
  }
  if (input.sessionStartOnly) rule.sessionStartOnly = true;
  if (
    typeof input.maxViews === "number" &&
    Number.isFinite(input.maxViews) &&
    input.maxViews > 0
  ) {
    rule.maxViews = Math.trunc(input.maxViews);
  }

  const excludeOrganizationIds = toNormalizedUniqueStrings(input.excludeOrganizationIds);
  if (excludeOrganizationIds.length) rule.excludeOrganizationIds = excludeOrganizationIds;

  const excludeRoles = toNormalizedRoles(input.excludeRoles);
  if (excludeRoles.length) rule.excludeRoles = excludeRoles;

  const excludeCapabilities = toNormalizedCapabilities(input.excludeCapabilities);
  if (excludeCapabilities.length) rule.excludeCapabilities = excludeCapabilities;

  const excludeUserIds = toNormalizedUniqueStrings(input.excludeUserIds);
  if (excludeUserIds.length) rule.excludeUserIds = excludeUserIds;

  return rule;
}

export function evaluateVisibilityRule(
  rawRule: unknown,
  context: TargetingVisibilityContext,
): VisibilityEvaluationResult {
  const rule = normalizeVisibilityRule(rawRule);
  const orgSet = new Set((context.organizationIds ?? []).map((item) => item.trim()).filter(Boolean));
  const roleSet = new Set(
    (context.roles ?? [])
      .map((item) => String(item ?? "").trim())
      .filter((item): item is Role => ROLE_SET.has(item as Role)),
  );
  const capabilitySet = new Set(
    Array.from(context.capabilities ?? [])
      .map((item) => String(item ?? "").trim())
      .filter(Boolean),
  );
  const userId = String(context.userId ?? "").trim();

  if (rule.organizationId && !orgSet.has(rule.organizationId)) {
    return { visible: false, reason: "missing_organization" };
  }
  if (rule.newUserOnly && !context.newUser) {
    return { visible: false, reason: "new_user_only" };
  }
  if (rule.requiredCapability && !capabilitySet.has(rule.requiredCapability)) {
    return { visible: false, reason: "missing_capability" };
  }

  if (
    rule.excludeOrganizationIds.length &&
    rule.excludeOrganizationIds.some((organizationId) => orgSet.has(organizationId))
  ) {
    return { visible: false, reason: "excluded_organization" };
  }
  if (rule.excludeRoles.length && rule.excludeRoles.some((role) => roleSet.has(role))) {
    return { visible: false, reason: "excluded_role" };
  }
  if (
    rule.excludeCapabilities.length &&
    rule.excludeCapabilities.some((capability) => capabilitySet.has(capability))
  ) {
    return { visible: false, reason: "excluded_capability" };
  }
  if (userId && rule.excludeUserIds.includes(userId)) {
    return { visible: false, reason: "excluded_user" };
  }

  return { visible: true, reason: "allowed" };
}
