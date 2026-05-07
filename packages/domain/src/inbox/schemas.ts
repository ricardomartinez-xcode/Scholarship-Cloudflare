export function validateSendMessageInput(input: { threadId?: string; content?: string }) {
  if (!input.threadId?.trim()) throw new Error("threadId requerido");
  if (!input.content?.trim()) throw new Error("content requerido");
}
