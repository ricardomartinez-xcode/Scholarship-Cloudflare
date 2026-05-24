import { afterEach, describe, expect, it } from "vitest";

import {
  getDirectoryReadMode,
  getDirectoryWriteMode,
  getPricingReadMode,
  getQuoteMode,
  shouldMirrorLegacyDirectoryWrites,
  shouldMirrorLegacyPricingWrites,
} from "@/lib/runtime-modes";

const ENV_KEYS = [
  "PRICING_READ_MODE",
  "DIRECTORY_READ_MODE",
  "DIRECTORY_WRITE_MODE",
  "QUOTE_MODE",
] as const;

describe("runtime mode defaults", () => {
  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it("defaults pricing and quote paths to canonical to avoid legacy reads", () => {
    delete process.env.PRICING_READ_MODE;
    delete process.env.QUOTE_MODE;

    expect(getPricingReadMode()).toBe("canonical");
    expect(getQuoteMode()).toBe("canonical");
    expect(shouldMirrorLegacyPricingWrites()).toBe(false);
  });

  it("keeps directory reads/writes canonical by default", () => {
    delete process.env.DIRECTORY_READ_MODE;
    delete process.env.DIRECTORY_WRITE_MODE;

    expect(getDirectoryReadMode()).toBe("canonical");
    expect(getDirectoryWriteMode()).toBe("canonical");
    expect(shouldMirrorLegacyDirectoryWrites()).toBe(false);
  });

  it("ignores explicit legacy or compare modes for pricing and quote paths", () => {
    process.env.PRICING_READ_MODE = "compare";
    process.env.QUOTE_MODE = "legacy";

    expect(getPricingReadMode()).toBe("canonical");
    expect(getQuoteMode()).toBe("canonical");
    expect(shouldMirrorLegacyPricingWrites()).toBe(false);
  });
});
