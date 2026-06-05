type OpenApiObject = Record<string, unknown>;

function isOpenApiObject(value: unknown): value is OpenApiObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasValidProperties(value: unknown): value is OpenApiObject {
  return isOpenApiObject(value);
}

function normalizeOpenApiValue(value: unknown, seen: WeakSet<object>): void {
  if (typeof value !== "object" || value === null) return;
  if (seen.has(value)) return;

  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item) => normalizeOpenApiValue(item, seen));
    return;
  }

  const objectValue = value as OpenApiObject;

  Object.values(objectValue).forEach((childValue) => normalizeOpenApiValue(childValue, seen));

  if (objectValue.type === "object" && !hasValidProperties(objectValue.properties)) {
    objectValue.properties = {};
  }
}

export function normalizeOpenApiObjectSchemas<T>(spec: T): T {
  normalizeOpenApiValue(spec, new WeakSet<object>());
  return spec;
}
