/**
 * 계층 관통 회귀 테스트 — CR-01 (07-VERIFICATION.md `missing:` 2번).
 *
 * 이 테스트는 renderer 판정(`shouldRecheckTokenExpiry`) + main 엔진(`ApplyEngine`) +
 * renderer 뷰(`describeTokenExpiryNotice`)를 한 사슬로 조립해 검증한다 — 브라우저
 * 모드에서 재로그인이 실제로 완료되면(`login-success`) 새 토큰의 `exp` 로 만료가
 * 다시 판정되어 대기 화면 경고가 갱신되거나 사라진다는 사실(D-10, R022)을 어느 한
 * 계층의 단위 테스트로는 증명할 수 없으므로, 이 파일을 `src/__tests__/` 에 둔다
 * (vitest.config.ts 의 include 글롭이 이 경로를 그대로 잡는다 — 아래 include 배열의
 * 첫 항목: "src", "**", "__tests__", "**", "*.test.ts" 를 순서대로 이어 붙인 패턴).
 *
 * 목 구성은 `src/main/services/__tests__/apply-engine.test.ts` 의 것을 경로만 고쳐
 * 그대로 옮긴다 — 이 저장소의 기존 관례(테스트 픽스처 복제)를 따른다.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApplyEngine } from "../main/services/apply-engine";
import { shouldRecheckTokenExpiry } from "../renderer/auth-event-navigation";
import { describeTokenExpiryNotice } from "../renderer/components/apply-execution-view";
import type { FormSchema, TimeSyncResult } from "../shared/types";

// ── JWT fixture helper (apply-engine.test.ts / auth-service.test.ts 와 동일) ──

function base64urlEncode(obj: object): string {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function makeJwt(payload: object): string {
  const header = base64urlEncode({ alg: "HS256", typ: "JWT" });
  const body = base64urlEncode(payload);
  return `${header}.${body}.fakesig`;
}

const DEFAULT_TEST_TOKEN = "test-token-that-is-long-enough-for-masking-purposes-here";

// ── Mocks (경로만 src/__tests__/ 기준으로 고쳐 apply-engine.test.ts 에서 복제) ──

vi.mock("../main/services/weverse-api", () => {
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

vi.mock("electron", () => ({
  app: { getPath: () => "/tmp" },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (s: string) => Buffer.from(s),
    decryptString: (b: Buffer) => b.toString(),
  },
}));

const { tokenBox } = vi.hoisted(() => ({ tokenBox: { current: "" } }));
tokenBox.current = DEFAULT_TEST_TOKEN;

vi.mock("../main/services/auth-service", () => ({
  authService: {
    get token() {
      return tokenBox.current;
    },
  },
}));

vi.mock("../main/services/profile-store", () => ({
  profileStore: {
    getProfile: () => ({
      fanId: 12345,
      phone: "01012345678",
      birthDate: "1990-01-01",
      name: "테스트",
    }),
  },
}));

beforeEach(() => {
  tokenBox.current = DEFAULT_TEST_TOKEN;
});

// ── Fixtures (apply-engine.test.ts 에서 복제) ──────────────────────────────

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
    submitApplication: vi.fn(async () => ({ serverDate: "Wed, 14 May 2026 11:30:00 GMT" })),
    pollStatus: vi.fn(async () => ({ status: "COMPLETED" })),
    ...overrides,
  };
}

function makeTiming(overrides: Record<string, unknown> = {}) {
  const syncResult = makeSyncResult();
  return {
    syncTime: vi.fn(async () => syncResult),
    calculateSubmitTime: vi.fn(() => Date.now() - 1),
    waitUntilSubmitTime: vi.fn(async () => undefined),
    isTimeGuardPassed: vi.fn(() => true),
    ...overrides,
  };
}

/** 만료 임박 토큰으로 arm() 까지 마친 엔진을 만든다. */
async function setupArmedWithNearExpiryToken() {
  const engine = new ApplyEngine(makeApi() as never, makeTiming() as never);
  const schema = await engine.fetchForm("EVENT001");
  const plannedSubmitAtMs = new Date(schema.applyPeriod.startAt).getTime();

  const nearExpSec = Math.floor((plannedSubmitAtMs + 1_000) / 1000);
  tokenBox.current = makeJwt({ exp: nearExpSec });

  engine.arm([100], [1, 2]);

  return { engine, plannedSubmitAtMs };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("재로그인 완료 → 만료 재판정 → 경고 해제 (CR-01, D-10, R022)", () => {
  it("만료 임박 토큰으로 arm() 직후 배너가 visible=true, showRelogin=true 다", async () => {
    const { engine } = await setupArmedWithNearExpiryToken();

    const notice = describeTokenExpiryNotice(engine.checkTokenExpiry());

    expect(notice.visible).toBe(true);
    expect(notice.showRelogin).toBe(true);
  });

  it("shouldRecheckTokenExpiry('login-success', 'apply-execution') 이 true 다 — 재판정 트리거", () => {
    expect(shouldRecheckTokenExpiry("login-success", "apply-execution")).toBe(true);
  });

  it("shouldRecheckTokenExpiry('login-success', 'profile') 은 false 다 — 대기 중이 아니면 사슬이 시작되지 않는다(대조군)", () => {
    expect(shouldRecheckTokenExpiry("login-success", "profile")).toBe(false);
  });

  it("재로그인 성공(토큰 교체) 후 checkTokenExpiry() 를 부르면 배너가 사라진다(visible=false)", async () => {
    const { engine, plannedSubmitAtMs } = await setupArmedWithNearExpiryToken();

    // 재로그인 성공을 흉내낸다 — 신청 예정 시각보다 충분히 뒤인 exp 로 교체.
    const farExpSec = Math.floor((plannedSubmitAtMs + 10 * 60 * 1000) / 1000);
    tokenBox.current = makeJwt({ exp: farExpSec });

    // login-success 도착 시점의 판정 — 이 배치가 닫는 바로 그 경로.
    const shouldRecheck = shouldRecheckTokenExpiry("login-success", "apply-execution");
    expect(shouldRecheck).toBe(true);

    const state = engine.checkTokenExpiry();
    const notice = describeTokenExpiryNotice(state);

    expect(state.status).toBe("safe");
    expect(notice.visible).toBe(false);
  });

  it("토큰을 교체하지 않은 채(재로그인 실패) 같은 사슬을 돌리면 배너가 visible=true 로 남는다 — 시도만으로 안심시키지 않는다(실패 대조군)", async () => {
    const { engine } = await setupArmedWithNearExpiryToken();

    // 토큰 미교체 — 재로그인이 실패했거나 아직 완료되지 않은 상태를 흉내낸다.
    const shouldRecheck = shouldRecheckTokenExpiry("login-failed", "apply-execution");
    expect(shouldRecheck).toBe(true);

    const state = engine.checkTokenExpiry();
    const notice = describeTokenExpiryNotice(state);

    expect(state.status).toBe("warning");
    expect(notice.visible).toBe(true);
  });

  it("재판정 전후로 getState().phase 와 postSubmitted 가 동일하다 — 신청 상태 불변(T-07-14, Pitfall 3)", async () => {
    const { engine, plannedSubmitAtMs } = await setupArmedWithNearExpiryToken();

    const phaseBefore = engine.getState().phase;
    const postSubmittedBefore = engine.getState().postSubmitted;

    const farExpSec = Math.floor((plannedSubmitAtMs + 10 * 60 * 1000) / 1000);
    tokenBox.current = makeJwt({ exp: farExpSec });
    engine.checkTokenExpiry();
    engine.checkTokenExpiry();

    expect(engine.getState().phase).toBe(phaseBefore);
    expect(engine.getState().postSubmitted).toBe(postSubmittedBefore);
  });
});
