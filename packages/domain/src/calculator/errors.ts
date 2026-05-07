export class CalculatorValidationError extends Error {
  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CalculatorValidationError";
  }
}

export class CalculatorNotFoundError extends Error {
  constructor(message = "No se encontró combinación de cotización.") {
    super(message);
    this.name = "CalculatorNotFoundError";
  }
}
