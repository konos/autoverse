/**
 * 로그인 방식 저장의 두 경로(탭 클릭 / 고지 확인)가 쓰는 실패 계약을 소유하는
 * 순수 액션 모듈 — JSX 없음, DOM 없음, preload 브리지를 직접 참조하지 않는다.
 * 모든 부수효과는 주입된 `LoginModeActionDeps` 를 통해서만 일어난다.
 *
 * TASK 1 (RED, 06-08 gap closure): 이 커밋 시점의 `createLoginModeActions()`
 * 는 오늘의 실제 배선을 **그대로 옮겨 적었다** — 실패를 삼키는 저장 헬퍼
 * 하나를 `setLoginMode`(탭 경로)와 `acknowledgeApiModeNotice`(모달 경로)가
 * 공유한다. 이것이 06-VERIFICATION.md gap 1 / 06-REVIEW.md CR-01 이 서술하는
 * 결함이며, 아래 회귀 테스트의 Test 1 이 이 상태에서 실제로 실패한다. 다음
 * 커밋(Task 2, GREEN)이 저장 헬퍼를 strict/safe 두 개로 분리해 확인 경로만
 * 실패를 반환값으로 보고하도록 고친다 — 이 파일의 이 주석도 그때 교체된다.
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
  // 오늘의 배선: 두 경로가 이 하나의 헬퍼를 공유한다 — 실패해도 예외를 밖으로
  // 던지지 않고 배너 콜백만 호출한 뒤 정상 resolve 한다.
  const saveModeSwallowing = async (mode: LoginMode): Promise<void> => {
    try {
      await deps.persistLoginMode(mode);
      deps.onModeApplied(mode);
      deps.onBannerError(null);
    } catch (err) {
      deps.onDiagnostic?.(err);
      deps.onBannerError(LOGIN_MODE_SAVE_ERROR);
    }
  };

  const setLoginMode = async (mode: LoginMode): Promise<void> => {
    await saveModeSwallowing(mode);
  };

  const acknowledgeApiModeNotice = async (version: number): Promise<AcknowledgeOutcome> => {
    try {
      await deps.persistNoticeAck(version);
      deps.onNoticeAcked(version);
      // 결함 지점: 모드 저장이 실패해도 saveModeSwallowing 이 예외를 삼키므로
      // 아래 라인은 항상 통과해 { ok: true } 를 돌려준다.
      await saveModeSwallowing("api");
      return { ok: true };
    } catch (err) {
      deps.onDiagnostic?.(err);
      return { ok: false, error: NOTICE_SAVE_ERROR };
    }
  };

  return { setLoginMode, acknowledgeApiModeNotice };
}
