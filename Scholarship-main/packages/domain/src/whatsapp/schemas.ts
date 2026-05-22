export function validateWhatsappText(content: string) {
  return content.trim().length > 0 && content.length <= 4096;
}
