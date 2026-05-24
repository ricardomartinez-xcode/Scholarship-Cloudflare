export type AdminPricingScope = {
  region?: string | null;
  plantel?: string | null;
  tier?: string | null;
  modality?: string | null;
  kind?: string | null;
  value?: string | number | null;
};

const collator = new Intl.Collator("es-MX", {
  numeric: true,
  sensitivity: "base",
});

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function isOnlineScope(scope: AdminPricingScope) {
  const plantel = clean(scope.plantel).toLowerCase();
  const modality = clean(scope.modality).toLowerCase();
  const kind = clean(scope.kind).toLowerCase();
  return plantel === "online" || modality === "online" || kind === "online";
}

export function normalizeAdminPricingRegion(region: unknown) {
  return clean(region) || "General";
}

export function formatAdminPricingPlantel(scope: AdminPricingScope) {
  const plantel = clean(scope.plantel);
  if (!plantel) return "Todos";
  if (plantel.toLowerCase() === "online") return "Online";
  return plantel;
}

export function formatAdminPricingTier(scope: AdminPricingScope) {
  if (isOnlineScope(scope)) return "Online";
  const tier = clean(scope.tier).toUpperCase();
  if (!tier || tier === "ANY" || tier === "GENERAL") return "General";
  return tier;
}

function tierRank(scope: AdminPricingScope) {
  if (isOnlineScope(scope)) return 99;
  const label = formatAdminPricingTier(scope);
  if (label === "General") return 0;
  const match = label.match(/^T([0-9]+)$/);
  return match ? Number(match[1]) : 50;
}

export function compareAdminPricingScope(left: AdminPricingScope, right: AdminPricingScope) {
  const region = collator.compare(
    normalizeAdminPricingRegion(left.region),
    normalizeAdminPricingRegion(right.region),
  );
  if (region !== 0) return region;

  const plantel = collator.compare(
    formatAdminPricingPlantel(left),
    formatAdminPricingPlantel(right),
  );
  if (plantel !== 0) return plantel;

  const tier = tierRank(left) - tierRank(right);
  if (tier !== 0) return tier;

  return collator.compare(clean(left.value), clean(right.value));
}
