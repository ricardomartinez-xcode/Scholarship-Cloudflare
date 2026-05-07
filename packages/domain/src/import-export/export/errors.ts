export class ExportValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportValidationError";
  }
}
