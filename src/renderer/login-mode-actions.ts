/**
 * 로그인 방식 저장의 두 경로(탭 클릭 / 고지 확인)가 쓰는 실패 계약을 소유하는
 * 순수 액션 모듈 — JSX 없음, DOM 없음, preload 브리지를 직접 참조하지 않는다.
 * 모든 부수효과는 주입된 `LoginModeActionDeps` 를 통해서만 일어난다.
 *
 * 두 경로는 정반대의 실패 계약을 요구한다(06-VERIFICATION.md gap 1 /
 * 06-REVIEW.md CR-01):
 * - 탭 클릭(`setLoginMode`) 은 fire-and-forget 이다 — 저장이 실패해도 절대
 *   reject 하지 않고 상단 배너로만 알린다(UI-SPEC E1 error). 탭은 이전
 *   선택으로 남는다.
 * - 고지 확인(`acknowledgeApiModeNotice`) 은 실패를 **반드시 반환값으로
 *   드러내야** 한다 — 그래야 호출자(LoginPanel)가 모달을 닫지 않고 인라인
 *   오류를 보여줄 수 있다(UI-SPEC E3 error). 이 계약을 어기고 두 경로가
 *   실패를 삼키는 헬퍼 하나를 공유했던 것이 CR-01 이었다.
 *
 * 아래 `saveModeStrict`/`saveModeSafe` 분리가 이 두 계약을 타입 수준에서
 * 갈라놓는다 — `acknowledgeApiModeNotice` 는 strict 만 쓸 수 있고, strict 는
 * 절대 실패를 삼키지 않는다.
 */
import type { LoginMode } from "../shared/types";

/** UI-SPEC E1 error 확정 문구 — 탭 클릭 경로의 상단 배너. App.tsx 의 기존 catch 문구를 그대로 옮겼다. */
export const LOGIN_MODE_SAVE_ERROR = "설정 저장에 실패했습니다. 다시 시도해주세요.";

/** UI-SPEC E3 error 확정 문구 — 고지 모달 인라인. LoginPanel.tsx 의 기존 catch 문구를 그대로 옮겼다. 탭 경로 문구와 통합하지 않는다. */
export const NOTICE_SAVE_ERROR = "저장에 실패했습니다. 다시 시도해주세요.";

export interface LoginModeActionDeps {
  persistLoginMode: (mode: LoginMode) => Promise<void>;
  persistNoticeAck: (version: number) => Promise<void>;
  onModeApplied: (mode: LoginMode) => void;
  onNoticeAcked: (version: number) => void;
  onBannerError: (message: string | null) => void;
  onDiagnostic?: (err: unknown) => void;
}

export type AcknowledgeOutcome = { ok: true } | { ok: false; error: string };

export interface LoginModeActions {
  setLoginMode: (mode: LoginMode) => Promise<void>;
  acknowledgeApiModeNotice: (version: number) => Promise<AcknowledgeOutcome>;
}

export function createLoginModeActions(deps: LoginModeActionDeps): LoginModeActions {
  // strict: 저장이 실패하면 예외를 그대로 위로 던진다(삼키지 않는다).
  // acknowledgeApiModeNotice 전용 — 확인 흐름은 저장 실패를 반드시 알아야
  // 모달을 열어 둔 채 재시도를 안내할 수 있다(UI-SPEC E3 error, CR-01).
  const saveModeStrict = async (mode: LoginMode): Promise<void> => {
    await deps.persistLoginMode(mode);
    deps.onModeApplied(mode);
    deps.onBannerError(null);
  };

  // safe: strict 를 감싸 예외를 삼킨다. setLoginMode(탭 클릭 경로) 전용 —
  // 탭 경로는 저장이 실패해도 절대 reject 하지 않고 상단 배너로만 알린다
  // (UI-SPEC E1 error). 탭은 이전 선택으로 남는다.
  const saveModeSafe = async (mode: LoginMode): Promise<void> => {
    try {
      await saveModeStrict(mode);
    } catch (err) {
      deps.onDiagnostic?.(err);
      deps.onBannerError(LOGIN_MODE_SAVE_ERROR);
    }
  };

  const setLoginMode = async (mode: LoginMode): Promise<void> => {
    await saveModeSafe(mode);
  };

  const acknowledgeApiModeNotice = async (version: number): Promise<AcknowledgeOutcome> => {
    try {
      await deps.persistNoticeAck(version);
      deps.onNoticeAcked(version);
      // strict 만 쓴다 — 모드 저장이 실패하면 여기서 예외가 던져지고 아래
      // catch 로 떨어져 { ok: false } 를 반환한다. onModeApplied 는 절대
      // 호출되지 않는다(저장에 실패했는데 상태만 바뀌는 일이 없다).
      await saveModeStrict("api");
      return { ok: true };
    } catch (err) {
      deps.onDiagnostic?.(err);
      // 실패 표시는 모달 안에서만 한다 — onBannerError 는 여기서 호출하지
      // 않는다(모달 실패를 상단 배너로 중복 표시하지 않는다, UI-SPEC E3).
      return { ok: false, error: NOTICE_SAVE_ERROR };
    }
  };

  return { setLoginMode, acknowledgeApiModeNotice };
}
