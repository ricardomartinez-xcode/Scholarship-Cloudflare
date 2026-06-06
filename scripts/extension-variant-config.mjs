import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export const sourceRoot = path.join(
  repoRoot,
  "apps",
  "chrome-extension",
  "recalc-sidepanel",
);

export const variantRoots = [
  path.join(repoRoot, "chrome-extension", "variants", "preview-first"),
];

export const allowedVariantRoots = [
  ...variantRoots,
  path.join(repoRoot, "chrome-extension", "variants", "Premium-Sender-Backend"),
];

export const exactCopyFiles = [
  "panel.html",
  "panel.css",
  "injected/wa-main.js",
  "content/bridge.js",
  "lib/campaigns/buildMessage.js",
  "lib/storage/attachments.js",
  "lib/whatsapp/wa-chat.js",
  "branding/logo-recalc.png",
  "branding/logo-unidep.png",
  "icons/icon16.png",
  "icons/icon32.png",
  "icons/icon48.png",
  "icons/icon128.png",
];
