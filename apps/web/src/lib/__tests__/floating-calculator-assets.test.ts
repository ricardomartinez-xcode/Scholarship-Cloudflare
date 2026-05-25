import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("floating calculator assets", () => {
  it("prioritizes the collapsed rail image because it is above the fold", () => {
    const source = readFileSync(
      resolve(root, "apps/web/src/components/unidep/FloatingCalculator.tsx"),
      "utf8",
    );

    const railImage = source.match(
      /<Image[\s\S]*?className="ui-floating-calculator__rail-image"[\s\S]*?\/>/,
    );

    expect(railImage?.[0]).toContain("priority");
  });
});
