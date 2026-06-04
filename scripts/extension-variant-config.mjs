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

export const manualVariantRoots = [
];

export const exactCopyFiles = [
  "manifest.json",
  "background.js",
  "campaigns.js",
  "content-whatsapp.js",
  "panel.html",
  "panel.css",
  "panel.js",
  "injected/wa-main.js",
  "content/bridge.js",
  "lib/campaigns/buildMessage.js",
  "lib/campaigns/runCampaign.js",
  "lib/storage/attachments.js",
  "lib/whatsapp/wa-chat.js",
  "lib/whatsapp/wa-attachments.js",
  "lib/whatsapp/wa-runner.js",
  "lib/whatsapp/wa-selectors.js",
  "lib/whatsapp/wa-text.js",
  "branding/logo-recalc.png",
  "branding/logo-unidep.png",
  "icons/icon16.png",
  "icons/icon32.png",
  "icons/icon48.png",
  "icons/icon128.png",
];
