export function validateMetaWebhookInput(input: { object?: string }) {
  return Boolean(input.object?.trim());
}
