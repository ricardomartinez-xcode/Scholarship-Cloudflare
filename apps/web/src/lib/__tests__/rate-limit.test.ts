import { afterEach, describe, expect, it, vi } from "vitest";

import {
  __getRateLimitBucketCountForTests,
  __resetRateLimitForTests,
  checkRateLimit,
  getRateLimitStoreState,
} from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.RATE_LIMIT_MAX_BUCKETS;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.unstubAllGlobals();
    __resetRateLimitForTests();
  });

  it("expires stale buckets before applying the next request", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-24T00:00:00.000Z"));

    expect((await checkRateLimit("one", { limit: 1, windowMs: 1_000 })).ok).toBe(true);
    expect((await checkRateLimit("one", { limit: 1, windowMs: 1_000 })).ok).toBe(false);

    vi.setSystemTime(new Date("2026-05-24T00:01:01.000Z"));

    expect((await checkRateLimit("one", { limit: 1, windowMs: 1_000 })).ok).toBe(true);
  });

  it("bounds the in-memory bucket count", async () => {
    process.env.RATE_LIMIT_MAX_BUCKETS = "2";

    expect((await checkRateLimit("one")).ok).toBe(true);
    expect((await checkRateLimit("two")).ok).toBe(true);
    expect((await checkRateLimit("three")).ok).toBe(true);

    expect(__getRateLimitBucketCountForTests()).toBeLessThanOrEqual(2);
  });

  it("uses Upstash Redis when shared rate limit env is configured", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ result: null }, { result: 2 }, { result: 42_000 }],
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkRateLimit("shared:key", { limit: 1, windowMs: 60_000 });

    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://redis.example/multi-exec",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token",
          "Content-Type": "application/json",
        }),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual([
      ["SET", expect.stringMatching(/^recalc:rate-limit:/), "0", "PX", expect.any(Number), "NX"],
      ["INCR", expect.stringMatching(/^recalc:rate-limit:/)],
      ["PTTL", expect.stringMatching(/^recalc:rate-limit:/)],
    ]);
    expect(result).toEqual({ ok: false, retryAfterMs: 42_000 });
  });

  it("fails closed when the configured shared store is unavailable", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("redis down")));

    const result = await checkRateLimit("shared:key", { limit: 5, windowMs: 60_000 });

    expect(result).toEqual({ ok: false, retryAfterMs: 1_000 });
  });

  it("reports whether the shared Upstash store is configured without exposing secrets", () => {
    expect(getRateLimitStoreState()).toEqual({
      sharedStoreConfigured: false,
      missing: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
      store: "memory",
    });

    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";

    expect(getRateLimitStoreState()).toEqual({
      sharedStoreConfigured: true,
      missing: [],
      store: "upstash",
    });
  });
});
