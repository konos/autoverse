/**
 * Unit tests for ApplyEngine — 오케스트레이터 + 안전 가드
 * Electron/network 의존성 없음. WeverseApi + TimingService를 DI로 주입.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApplyEngine } from "../apply-engine";
import type { FormSchema, TimeSyncResult } from "../../../shared/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Mock weverse-api to avoid @shared/mask alias resolution in Vitest
vi.mock("../weverse-api", () => {
  class WeverseApiError extends Error {
    code: string;
    statusCode?: number;
    constructor(code: string, message: string, statusCode?: number) {
      super(message);
      this.name = "WeverseApiError";
      this.code = code;
      this.statusCode = statusCode;
    }
  }
  return { WeverseApi: class {}, WeverseApiError };
});

// Mock Electron modules
vi.mock("electron", () => ({
  app: { getPath: () => "/tmp" },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString(),
  },
}));

// Mock authService to return a test token
vi.mock("../auth-service", () => ({
  authService: { token: "test-token-that-is-long-enough-for-masking-purposes-here" },
}));

// Mock profileStore to return a test profile
vi.mock("../profile-store", () => ({
  profileStore: {
    getProfile: () => ({
      fanId: 12345,
      phone: "01012345678",
      birthDate: "1990-01-01",
      name: "테스트",
    }),
  },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSchema(overrides: Partial<FormSchema> = {}): FormSchema {
  return {
    eventPublicId: "EVENT001",
    artistName: "TestArtist",
    artistCode: "TEST",
    officialMembershipResponse: [],
    languages: ["ko"],
    primaryLanguage: "ko",
    applyPeriod: {
      formOpenAt: new Date(Date.now() - 10_000).toISOString(),
      startAt: new Date(Date.now() + 60_000).toISOString(),
      endAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
    requiresShopPurchaseConsent: false,
    applyType: "FIFO",
    display: {
      headerImageUrl: null,
      title: { ko: "테스트 이벤트" },
      description: { ko: "설명" },
      material: {},
    },
    formConfiguration: [],
    consents: [
      { id: 1, title: { ko: "약관1" }, body: { ko: "내용1" }, order: 1 },
      { id: 2, title: { ko: "약관2" }, body: { ko: "내용2" }, order: 2 },
    ],
    rewardGroups: [
      {
        id: 10,
        type: "STANDARD",
        title: { ko: "그룹A" },
        useCheckIn: false,
        isSelectable: true,
        maxSelectableCount: 1,
        order: 1,
        rewards: [{ id: 100, type: "TICKET", title: { ko: "티켓A" } }],
      },
    ],
    applyToken: "a".repeat(32),
    applyHost: "https://apply.test.weverse.io",
    responseType: "available",
    ...overrides,
  };
}

function makeSyncResult(offsetMs = 0, rttMs = 20): TimeSyncResult {
  const now = new Date();
  return { offsetMs, rttMs, serverTime: now, localTime: now };
}

function makeApi(overrides: Record<string, unknown> = {}) {
  return {
    fetchFormSchema: vi.fn(async () => makeSchema()),
    submitApplication: vi.fn(async () => undefined),
    pollStatus: vi.fn(async () => ({ status: "COMPLETED" })),
    ...overrides,
  };
}

function makeTiming(overrides: Record<string, unknown> = {}) {
  const syncResult = makeSyncResult();
  return {
    syncTime: vi.fn(async () => syncResult),
    calculateFireTime: vi.fn(() => Date.now() - 1), // already in the past → fire immediately
    waitUntilFireTime: vi.fn(async () => undefined),
    isTimeGuardPassed: vi.fn(() => true),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ApplyEngine — fetchForm", () => {
  it("폼 조회 성공 시 form-ready 상태로 전환하고 form-fetched 이벤트 emit", async () => {
    const api = makeApi();
    const timing = makeTiming();
    const engine = new ApplyEngine(api as never, timing as never);

    const events: string[] = [];
    engine.on("form-fetched", (e) => events.push(e.type));

    const schema = await engine.fetchForm("EVENT001");

    expect(schema.eventPublicId).toBe("EVENT001");
    expect(engine.getState().phase).toBe("form-ready");
    expect(events).toContain("form-fetched");
  });

  it("API 오류 시 error 상태로 전환하고 apply-error 이벤트 emit", async () => {
    const api = makeApi({
      fetchFormSchema: vi.fn(async () => {
        const err = Object.assign(new Error("네트워크 에러"), { code: "NETWORK_ERROR", name: "WeverseApiError" });
        throw err;
      }),
    });
    const timing = makeTiming();
    const engine = new ApplyEngine(api as never, timing as never);

    const errorEvents: string[] = [];
    engine.on("apply-error", (e) => errorEvents.push(e.error?.code ?? ""));

    await expect(engine.fetchForm("EVENT001")).rejects.toThrow();
    expect(engine.getState().phase).toBe("error");
    expect(errorEvents).toContain("NETWORK_ERROR");
  });

  it("responseType이 'available'이 아닐 때 SCHEMA_INVALID 에러", async () => {
    const api = makeApi({
      fetchFormSchema: vi.fn(async () => makeSchema({ responseType: "closed" })),
    });
    const timing = makeTiming();
    const engine = new ApplyEngine(api as never, timing as never);

    await expect(engine.fetchForm("EVENT001")).rejects.toThrow("폼 스키마 유효성 오류");
    expect(engine.getState().phase).toBe("error");
  });
});

describe("ApplyEngine — arm()", () => {
  it("올바른 consentIds로 arm 성공, armed 이벤트 emit", async () => {
    const engine = new ApplyEngine(makeApi() as never, makeTiming() as never);
    await engine.fetchForm("EVENT001");

    const events: string[] = [];
    engine.on("armed", (e) => events.push(e.type));

    engine.arm([100], [1, 2]);

    expect(engine.getState().phase).toBe("armed");
    expect(events).toContain("armed");
  });

  it("consentIds 불일치 시 오류", async () => {
    const engine = new ApplyEngine(makeApi() as never, makeTiming() as never);
    await engine.fetchForm("EVENT001");

    // 약관 ID 1, 2가 필요한데 1만 전달
    expect(() => engine.arm([100], [1])).toThrow("약관 동의 불일치");
  });

  it("fetchForm 전 arm 호출 시 오류", () => {
    const engine = new ApplyEngine(makeApi() as never, makeTiming() as never);
    expect(() => engine.arm([100], [1, 2])).toThrow("fetchForm()을 먼저 실행하세요");
  });

  it("consentIds 자동 채움 금지 — 전달된 값만 사용", async () => {
    const engine = new ApplyEngine(makeApi() as never, makeTiming() as never);
    await engine.fetchForm("EVENT001");

    const events: { consentIds: number[] }[] = [];
    engine.on("armed", (e) => events.push(e.data as { consentIds: number[] }));

    engine.arm([100], [1, 2]);

    expect(events[0].consentIds).toEqual([1, 2]);
    // should NOT auto-fill with schema consent IDs not provided by user
  });
});

describe("ApplyEngine — execute() 안전 가드", () => {
  it("POST 1회만 발사 — 두 번째 execute()는 POST_ALREADY_FIRED", async () => {
    let callCount = 0;
    const api = makeApi({
      submitApplication: vi.fn(async () => { callCount++; }),
      pollStatus: vi.fn(async () => ({ status: "COMPLETED" })),
    });
    const timing = makeTiming();
    const engine = new ApplyEngine(api as never, timing as never);

    await engine.fetchForm("EVENT001");
    engine.arm([100], [1, 2]);
    await engine.execute();

    expect(callCount).toBe(1);

    // Manually set phase back to armed to try again
    // (real guard is the postFired flag, not phase)
    (engine as unknown as { phase: string }).phase = "armed";

    await expect(engine.execute()).rejects.toThrow("POST 중복 차단");
    expect(callCount).toBe(1); // still 1
  });

  it("시간 가드 차단 시 TIME_GUARD_BLOCKED 에러", async () => {
    const timing = makeTiming({ isTimeGuardPassed: vi.fn(() => false) });
    const engine = new ApplyEngine(makeApi() as never, timing as never);

    await engine.fetchForm("EVENT001");
    engine.arm([100], [1, 2]);

    const errorEvents: string[] = [];
    engine.on("apply-error", (e) => errorEvents.push(e.error?.code ?? ""));

    await expect(engine.execute()).rejects.toThrow("시간 가드");
    expect(errorEvents).toContain("TIME_GUARD_BLOCKED");
  });

  it("arm 없이 execute() 호출 시 오류", async () => {
    const engine = new ApplyEngine(makeApi() as never, makeTiming() as never);
    await engine.fetchForm("EVENT001");
    await expect(engine.execute()).rejects.toThrow("execute() 호출 불가");
  });
});

describe("ApplyEngine — 폴링", () => {
  it("COMPLETED 상태 반환 시 성공", async () => {
    const api = makeApi({
      pollStatus: vi.fn(async () => ({ status: "COMPLETED" })),
    });
    const engine = new ApplyEngine(api as never, makeTiming() as never);

    await engine.fetchForm("EVENT001");
    engine.arm([100], [1, 2]);
    const result = await engine.execute();

    expect(result.status).toBe("COMPLETED");
    expect(engine.getState().phase).toBe("completed");
  });

  it("REJECTED 상태 반환 시 에러", async () => {
    const api = makeApi({
      pollStatus: vi.fn(async () => ({ status: "REJECTED" })),
    });
    const engine = new ApplyEngine(api as never, makeTiming() as never);

    await engine.fetchForm("EVENT001");
    engine.arm([100], [1, 2]);

    const errorCodes: string[] = [];
    engine.on("apply-error", (e) => errorCodes.push(e.error?.code ?? ""));

    await expect(engine.execute()).rejects.toThrow("REJECTED");
    expect(errorCodes).toContain("APPLY_REJECTED");
    expect(engine.getState().phase).toBe("error");
  });

  it("REQUESTED 이후 COMPLETED 전환 — 폴링 루프 동작", async () => {
    let callCount = 0;
    const api = makeApi({
      pollStatus: vi.fn(async () => {
        callCount++;
        return { status: callCount < 3 ? "REQUESTED" : "COMPLETED" };
      }),
    });
    const engine = new ApplyEngine(api as never, makeTiming() as never);

    await engine.fetchForm("EVENT001");
    engine.arm([100], [1, 2]);
    const result = await engine.execute();

    expect(result.status).toBe("COMPLETED");
    expect(callCount).toBe(3);
  });
});

describe("ApplyEngine — getState / reset", () => {
  it("초기 상태는 idle, postFired=false", () => {
    const engine = new ApplyEngine(makeApi() as never, makeTiming() as never);
    const state = engine.getState();
    expect(state.phase).toBe("idle");
    expect(state.postFired).toBe(false);
    expect(state.hasSchema).toBe(false);
  });

  it("reset() 후 초기 상태로 복원", async () => {
    const engine = new ApplyEngine(makeApi() as never, makeTiming() as never);
    await engine.fetchForm("EVENT001");
    engine.arm([100], [1, 2]);
    await engine.execute();

    engine.reset();

    const state = engine.getState();
    expect(state.phase).toBe("idle");
    expect(state.postFired).toBe(false);
    expect(state.hasSchema).toBe(false);
  });
});

describe("ApplyEngine — 이벤트 emit", () => {
  it("execute() 전체 흐름에서 모든 단계 이벤트가 emit됨", async () => {
    const engine = new ApplyEngine(makeApi() as never, makeTiming() as never);
    const emitted: string[] = [];

    engine.on("apply-event", (e) => emitted.push(e.type));

    await engine.fetchForm("EVENT001");
    engine.arm([100], [1, 2]);
    await engine.execute();

    expect(emitted).toContain("form-fetched");
    expect(emitted).toContain("armed");
    expect(emitted).toContain("time-synced");
    expect(emitted).toContain("post-fired");
    expect(emitted).toContain("poll-result");
    expect(emitted).toContain("completed");
  });
});
