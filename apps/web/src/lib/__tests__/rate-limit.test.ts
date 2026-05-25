import { afterEach, describe, expect, it, vi } from "vitest";

import {
  __getRateLimitBucketCountForTests,
  __resetRateLimitForTests,
  checkRateLimit,
} from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.RATE_LIMIT_MAX_BUCKETS;
    __resetRateLimitForTests();
  });

  it("expires stale buckets before applying the next request", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-24T00:00:00.000Z"));

    expect(checkRateLimit("one", { limit: 1, windowMs: 1_000 }).ok).toBe(true);
    expect(checkRateLimit("one", { limit: 1, windowMs: 1_000 }).ok).toBe(false);

    vi.setSystemTime(new Date("2026-05-24T00:01:01.000Z"));

    expect(checkRateLimit("one", { limit: 1, windowMs: 1_000 }).ok).toBe(true);
  });

  it("bounds the in-memory bucket count", () => {
    process.env.RATE_LIMIT_MAX_BUCKETS = "2";

    expect(checkRateLimit("one").ok).toBe(true);
    expect(checkRateLimit("two").ok).toBe(true);
    expect(checkRateLimit("three").ok).toBe(true);

    expect(__getRateLimitBucketCountForTests()).toBeLessThanOrEqual(2);
  });
});
