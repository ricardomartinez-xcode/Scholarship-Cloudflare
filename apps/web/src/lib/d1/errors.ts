export class D1DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "D1DomainError";
  }
}

export function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) {
    throw new D1DomainError(`${field} is required`, "validation_error", 400);
  }
}
