/**
 * `login-mode-actions.ts` 의 실제 모듈을 import 해서 검증한다 — 복제본이
 * 아니라 배포되는 코드를 테스트한다(login-panel-view.test.ts 관례를 따름).
 *
 * Test 1 은 06-VERIFICATION.md gap 1 / 06-REVIEW.md CR-01 의 회귀 테스트다 —
 * Task 1(RED) 시점에는 반드시 실패해야 하고, Task 2(GREEN) 이후 통과한다.
 * 이 파일의 Test 1~4 단언은 Task 2 에서 한 글자도 바뀌지 않는다.
 */
import { describe, it, expect, vi } from "vitest";
import { createLoginModeActions, LOGIN_MODE_SAVE_ERROR, NOTICE_SAVE_ERROR } from "../login-mode-actions";
import type { LoginModeActionDeps } from "../login-mode-actions";
import type { LoginMode } from "../../shared/types";

type MockDeps = {
  persistLoginMode: ReturnType<typeof vi.fn<(mode: LoginMode) => Promise<void>>>;
  persistNoticeAck: ReturnType<typeof vi.fn<(version: number) => Promise<void>>>;
  onModeApplied: ReturnType<typeof vi.fn<(mode: LoginMode) => void>>;
  onNoticeAcked: ReturnType<typeof vi.fn<(version: number) => void>>;
  onBannerError: ReturnType<typeof vi.fn<(message: string | null) => void>>;
  onDiagnostic: ReturnType<typeof vi.fn<(err: unknown) => void>>;
};

function makeDeps(overrides: Partial<LoginModeActionDeps> = {}): MockDeps {
  return {
    persistLoginMode: vi.fn<(mode: LoginMode) => Promise<void>>().mockResolvedValue(undefined),
    persistNoticeAck: vi.fn<(version: number) => Promise<void>>().mockResolvedValue(undefined),
    onModeApplied: vi.fn<(mode: LoginMode) => void>(),
    onNoticeAcked: vi.fn<(version: number) => void>(),
    onBannerError: vi.fn<(message: string | null) => void>(),
    onDiagnostic: vi.fn<(err: unknown) => void>(),
    ...overrides,
  } as MockDeps;
}

describe("createLoginModeActions — acknowledgeApiModeNotice (고지 확인 경로)", () => {
  it("Test 1: persistLoginMode 가 reject 하면 확인 결과는 실패이고 모달 인라인 확정 문구를 담아야 한다 (CR-01 회귀)", async () => {
    const deps = makeDeps({ persistLoginMode: vi.fn<(mode: LoginMode) => Promise<void>>().mockRejectedValue(new Error("disk write failed")) });
    const actions = createLoginModeActions(deps);

    const outcome = await actions.acknowledgeApiModeNotice(1);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toBe(NOTICE_SAVE_ERROR);
    }
  });

  it("Test 2: persistNoticeAck 가 reject 하면 persistLoginMode 는 한 번도 호출되지 않는다", async () => {
    const deps = makeDeps({ persistNoticeAck: vi.fn<(version: number) => Promise<void>>().mockRejectedValue(new Error("ack write failed")) });
    const actions = createLoginModeActions(deps);

    const outcome = await actions.acknowledgeApiModeNotice(1);

    expect(outcome.ok).toBe(false);
    expect(deps.persistLoginMode).not.toHaveBeenCalled();
  });

  it("Test 3: 두 저장이 모두 성공하면 ok:true 이고 onNoticeAcked·onModeApplied 가 각각 한 번씩 불리며 배너가 지워진다", async () => {
    const deps = makeDeps();
    const actions = createLoginModeActions(deps);

    const outcome = await actions.acknowledgeApiModeNotice(1);

    expect(outcome.ok).toBe(true);
    expect(deps.onNoticeAcked).toHaveBeenCalledTimes(1);
    expect(deps.onNoticeAcked).toHaveBeenCalledWith(1);
    expect(deps.onModeApplied).toHaveBeenCalledTimes(1);
    expect(deps.onModeApplied).toHaveBeenCalledWith("api");
    expect(deps.onBannerError).toHaveBeenCalledWith(null);
  });
});

describe("createLoginModeActions — setLoginMode (탭 클릭 경로)", () => {
  it("Test 4: persistLoginMode 가 reject 해도 setLoginMode 는 reject 하지 않고 탭 경로 확정 문구로 배너만 알린다", async () => {
    const deps = makeDeps({ persistLoginMode: vi.fn<(mode: LoginMode) => Promise<void>>().mockRejectedValue(new Error("disk write failed")) });
    const actions = createLoginModeActions(deps);

    await expect(actions.setLoginMode("api")).resolves.toBeUndefined();

    expect(deps.onBannerError).toHaveBeenCalledWith(LOGIN_MODE_SAVE_ERROR);
    expect(deps.onModeApplied).not.toHaveBeenCalled();
  });
});

describe("createLoginModeActions — 확인 경로 실패 시 상태 무결성 (T-06-31)", () => {
  it("Test 5: 확인 경로에서 모드 저장이 실패하면 onModeApplied 는 호출되지 않는다", async () => {
    const deps = makeDeps({ persistLoginMode: vi.fn<(mode: LoginMode) => Promise<void>>().mockRejectedValue(new Error("disk write failed")) });
    const actions = createLoginModeActions(deps);

    await actions.acknowledgeApiModeNotice(1);

    expect(deps.onModeApplied).not.toHaveBeenCalled();
  });

  it("Test 6: 확인 경로에서 모드 저장이 실패해도 onNoticeAcked 는 이미 호출된 상태다 (어긋난 상태가 관측 가능하다 — gap 1 의 핵심)", async () => {
    const deps = makeDeps({ persistLoginMode: vi.fn<(mode: LoginMode) => Promise<void>>().mockRejectedValue(new Error("disk write failed")) });
    const actions = createLoginModeActions(deps);

    await actions.acknowledgeApiModeNotice(1);

    expect(deps.onNoticeAcked).toHaveBeenCalledTimes(1);
    expect(deps.onNoticeAcked).toHaveBeenCalledWith(1);
  });

  it("Test 7: 확인 경로의 성공/실패 어느 쪽에서도 onBannerError 로 탭 경로 확정 문구가 나가지 않는다 (모달 안 실패를 상단 배너로 중복 표시하지 않는다)", async () => {
    const failDeps = makeDeps({ persistLoginMode: vi.fn<(mode: LoginMode) => Promise<void>>().mockRejectedValue(new Error("disk write failed")) });
    const failActions = createLoginModeActions(failDeps);
    await failActions.acknowledgeApiModeNotice(1);
    expect(failDeps.onBannerError).not.toHaveBeenCalledWith(LOGIN_MODE_SAVE_ERROR);

    const okDeps = makeDeps();
    const okActions = createLoginModeActions(okDeps);
    await okActions.acknowledgeApiModeNotice(1);
    expect(okDeps.onBannerError).not.toHaveBeenCalledWith(LOGIN_MODE_SAVE_ERROR);
  });
});
