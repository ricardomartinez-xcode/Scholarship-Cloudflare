export class RealtimePermissionError extends Error {
  constructor(message = "No tienes permisos para realtime.") {
    super(message);
    this.name = "RealtimePermissionError";
  }
}
