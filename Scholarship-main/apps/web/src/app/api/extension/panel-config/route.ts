import { NextResponse } from "next/server";

import { getExtensionPanelConfig } from "@/lib/extension-panel-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getExtensionPanelConfig();
  const { selectorPack: _selectorPack, selectorPackJson: _selectorPackJson, ...publicConfig } = config;
  return NextResponse.json(publicConfig, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
