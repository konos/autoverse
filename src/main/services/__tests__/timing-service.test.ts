/**
 * Unit tests for TimingService — §6 서버 시간 동기화 전략
 * Electron 의존성 없음. fetch를 주입(DI)해서 모킹.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TimingService } from "../timing-service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFetchWith(
  dateHeader: string | null,
  responseDelayMs = 0,
): typeof globalThis.fetch {
  return vi.fn(async () => {
    if (responseDelayMs > 0) {
      await new Promise((r) => setTimeout(r, responseDelayMs));
    }
    return {
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "date" ? dateHeader : null,
      },
      ok: true,
      status: 200,
    } as unknown as Response;
  });
}

function toRfc7231(date: Date): string {
  // e.g. "Mon, 12 May 2026 12:00:00 GMT"
  return date.toUTCString();
}

// ── parseServerDate ───────────────────────────────────────────────────────────

describe("TimingService.parseServerDate", () => {
  const svc = new TimingService();

  it("parses a valid RFC 7231 Date header", () => {
    const d = svc.parseServerDate("Mon, 12 May 2026 12:00:00 GMT");
    expect(d.toISOString()).toBe("2026-05-12T12:00:00.000Z");
  });

  it("throws on an invalid date string", () => {
    expect(() => svc.parseServerDate("not-a-date")).toThrow();
  });

  it("throws on empty string", () => {
    expect(() => svc.parseServerDate("")).toThrow();
  });

  it("handles date at epoch boundary", () => {
    const d = svc.parseServerDate("Thu, 01 Jan 1970 00:00:00 GMT");
    expect(d.getTime()).toBe(0);
  });
});

// ── calculateFireTime ─────────────────────────────────────────────────────────

describe("TimingService.calculateFireTime", () => {
  const svc = new TimingService();
  const startAt = new Date("2026-05-12T12:00:00.000Z");
  const startAtMs = startAt.getTime();

  it("subtracts offset and rtt/2 from startAt", () => {
    const sync = {
      offsetMs: 10,
      rttMs: 20,
      serverTime: startAt,
      localTime: startAt,
    };
    // raw = startAtMs - 10 - 10 = startAtMs - 20
    // floor = startAtMs - 50
    // startAtMs - 20 > startAtMs - 50 → no clamp
    expect(svc.calculateFireTime(startAt, sync)).toBe(startAtMs - 20);
  });

  it("clamps to startAt - 50ms when calculated fire time is too early", () => {
    // offset large → raw fire time << startAt - 50ms
    const sync = {
      offsetMs: 5_000,
      rttMs: 0,
      serverTime: startAt,
      localTime: startAt,
    };
    expect(svc.calculateFireTime(startAt, sync)).toBe(startAtMs - 50);
  });

  it("handles offsetMs=0 (no adjustment needed)", () => {
    const sync = {
      offsetMs: 0,
      rttMs: 0,
      serverTime: startAt,
      localTime: startAt,
    };
    // raw = startAtMs - 0 - 0 = startAtMs, but clamp floor = startAtMs - 50
    // startAtMs >= startAtMs - 50, so raw wins
    expect(svc.calculateFireTime(startAt, sync)).toBe(startAtMs);
  });

  it("handles negative offset (server behind local)", () => {
    const sync = {
      offsetMs: -200,
      rttMs: 100,
      serverTime: startAt,
      localTime: startAt,
    };
    // raw = startAtMs - (-200) - 50 = startAtMs + 150
    expect(svc.calculateFireTime(startAt, sync)).toBe(startAtMs + 150);
  });

  it("handles rttMs=0 (instantaneous response)", () => {
    const sync = {
      offsetMs: 10,
      rttMs: 0,
      serverTime: startAt,
      localTime: startAt,
    };
    // raw = startAtMs - 10 - 0 = startAtMs - 10
    // startAtMs - 10 > startAtMs - 50 → no clamp
    expect(svc.calculateFireTime(startAt, sync)).toBe(startAtMs - 10);
  });
});

// ── syncTime ─────────────────────────────────────────────────────────────────

describe("TimingService.syncTime", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("computes positive offset when server is ahead of local", async () => {
    // RFC 7231 has second-level precision only, so use a round-second offset
    // Local clock at t0 = exactly 1_000_000ms (1000s), server is 2000ms (2s) ahead
    const localNow = 1_000_000;
    vi.setSystemTime(localNow);

    // Server time at a round-second boundary so toRfc7231 → parse round-trip is lossless
    const serverTime = new Date(localNow + 2_000); // 2s ahead, integer seconds

    const fetchFn: typeof globalThis.fetch = vi.fn(async () => {
      return {
        headers: { get: () => toRfc7231(serverTime) },
        ok: true,
        status: 200,
      } as unknown as Response;
    });

    const svc = new TimingService(fetchFn);
    const result = await svc.syncTime("test-token");

    // rttMs=0 (no timer advance), localMidMs=localNow
    // offsetMs = serverNowMs - localMidMs = (localNow+2000) - localNow = 2000
    expect(result.offsetMs).toBeCloseTo(2_000, -2); // ±100ms tolerance
    expect(result.rttMs).toBeGreaterThanOrEqual(0);
    expect(result.serverTime.getTime()).toBe(serverTime.getTime());
  });

  it("falls back to offsetMs=0 when Date header is missing", async () => {
    vi.setSystemTime(1_000_000);
    const svc = new TimingService(makeFetchWith(null));
    const result = await svc.syncTime("token");

    expect(result.offsetMs).toBe(0);
    expect(result.rttMs).toBeGreaterThanOrEqual(0);
  });

  it("falls back to offsetMs=0 on malformed Date header", async () => {
    vi.setSystemTime(1_000_000);
    const svc = new TimingService(makeFetchWith("not-a-date"));
    const result = await svc.syncTime("token");

    expect(result.offsetMs).toBe(0);
  });

  it("includes rttMs from the round trip", async () => {
    // Simulate 100ms network delay
    const fetchFn: typeof globalThis.fetch = vi.fn(async () => {
      // advance fake timer inside the fetch to simulate delay
      vi.advanceTimersByTime(100);
      const serverDate = new Date(Date.now());
      return {
        headers: { get: () => toRfc7231(serverDate) },
        ok: true,
        status: 200,
      } as unknown as Response;
    });

    vi.setSystemTime(1_000_000);
    const svc = new TimingService(fetchFn);
    const result = await svc.syncTime("token");

    expect(result.rttMs).toBe(100);
  });

  it("uses Authorization Bearer header with the provided token", async () => {
    vi.setSystemTime(1_000_000);
    const fetchFn = makeFetchWith(toRfc7231(new Date(Date.now())));
    const svc = new TimingService(fetchFn);

    await svc.syncTime("my-secret-token");

    expect(fetchFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer my-secret-token",
        }),
      }),
    );
  });
});

// ── isTimeGuardPassed ─────────────────────────────────────────────────────────

describe("TimingService.isTimeGuardPassed", () => {
  const svc = new TimingService();

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns true when server time is past startAt - 50ms", () => {
    const startAt = new Date(Date.now() + 10); // 10ms from now
    vi.setSystemTime(startAt.getTime() - 49); // 49ms before startAt = past threshold

    const sync = {
      offsetMs: 0,
      rttMs: 0,
      serverTime: startAt,
      localTime: startAt,
    };
    expect(svc.isTimeGuardPassed(startAt, sync)).toBe(true);
  });

  it("returns false when server time is before startAt - 50ms", () => {
    const startAt = new Date(Date.now() + 1_000);
    vi.setSystemTime(startAt.getTime() - 200); // 200ms before startAt

    const sync = {
      offsetMs: 0,
      rttMs: 0,
      serverTime: startAt,
      localTime: startAt,
    };
    expect(svc.isTimeGuardPassed(startAt, sync)).toBe(false);
  });

  it("accounts for positive offsetMs (server ahead)", () => {
    const startAt = new Date(Date.now() + 1_000);
    // local time is 1500ms before startAt, but server is 1000ms ahead
    // server time = local + offset = (startAt - 1500) + 1000 = startAt - 500
    vi.setSystemTime(startAt.getTime() - 1_500);

    const sync = {
      offsetMs: 1_000,
      rttMs: 0,
      serverTime: startAt,
      localTime: startAt,
    };
    // serverNow = (startAt - 1500) + 1000 = startAt - 500 < startAt - 50 → BLOCKED
    expect(svc.isTimeGuardPassed(startAt, sync)).toBe(false);
  });

  it("returns true when offset corrected time exactly at threshold", () => {
    const startAt = new Date(1_000_000);
    vi.setSystemTime(startAt.getTime() - 50); // exactly at threshold

    const sync = {
      offsetMs: 0,
      rttMs: 0,
      serverTime: startAt,
      localTime: startAt,
    };
    // serverNow = (startAt - 50) + 0 = startAt - 50 = threshold → passed
    expect(svc.isTimeGuardPassed(startAt, sync)).toBe(true);
  });
});

// ── waitUntilFireTime ─────────────────────────────────────────────────────────

describe("TimingService.waitUntilFireTime", () => {
  it("resolves immediately for a past fireTime", async () => {
    const svc = new TimingService();
    const past = Date.now() - 100;
    const start = Date.now();
    await svc.waitUntilFireTime(past);
    // Should return quickly (< 100ms)
    expect(Date.now() - start).toBeLessThan(100);
  });

  it("waits approximately for a near-future fireTime (≤50ms)", async () => {
    const svc = new TimingService();
    const delay = 20;
    const fireTime = Date.now() + delay;
    const start = Date.now();
    await svc.waitUntilFireTime(fireTime);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(delay - 5);
    expect(elapsed).toBeLessThan(delay + 100);
  });

  it("waits for a slightly longer fireTime (>50ms)", async () => {
    const svc = new TimingService();
    const delay = 80;
    const fireTime = Date.now() + delay;
    const start = Date.now();
    await svc.waitUntilFireTime(fireTime);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(delay - 10);
    expect(elapsed).toBeLessThan(delay + 150);
  });
});
