/**
 * `LoginPanel`의 판단 로직만 담는 순수 모듈 — JSX 없음, DOM 없음.
 *
 * 이 저장소의 기존 렌더러 테스트(`profile-form-validation.test.ts`)는 판단 함수를
 * 테스트 파일 안에 복제해 두는 관례를 쓰지만, 여기서는 실제 배포되는 코드를
 * 검증하기 위해 이 모듈을 직접 import해서 테스트한다.
 *
 * `lockedByEnv ↔ 탭 disabled ↔ 배지 렌더링`은 반드시 같은 입력값에서 함께
 * 파생돼야 한다(UI-SPEC key_links) — 셋을 따로 계산하면 UI가 거짓말할 수 있다.
 * `resolveTabView()`가 이 세 값을 한 곳에서 만든다.
 */
import type { LoginMode, CredentialLoginResult } from "../../shared/types";
import { API_MODE_NOTICE_VERSION, shouldShowApiModeNotice } from "../../shared/api-mode-notice";
import { mapLoginFailure } from "../../shared/login-failure";

export interface TabView {
  active: LoginMode;
  tabsDisabled: boolean;
  showBadge: boolean;
}

/** 탭 활성 상태 · 비활성화 · 배지 노출 여부를 한 번에 계산한다 — 셋 다 `lockedByEnv`에서 파생된다. */
export function resolveTabView(mode: LoginMode, lockedByEnv: boolean): TabView {
  return {
    active: mode,
    tabsDisabled: lockedByEnv,
    showBadge: lockedByEnv,
  };
}

const MODE_LABEL: Record<LoginMode, string> = {
  api: "API 로그인",
  browser: "브라우저 로그인",
};

/**
 * 환경변수 잠금 배지의 상세 문구. 현재 적용 중인 모드 라벨만 끼워 넣는다 —
 * `AUTOVERSE_LOGIN_MODE`의 원문 값은 이 함수의 입력에도, 출력에도 등장하지 않는다.
 */
export function describeLockedMode(mode: LoginMode): string {
  return `AUTOVERSE_LOGIN_MODE 환경변수가 설정되어 있어 이 화면에서 방식을 변경할 수 없습니다. 현재 적용 중: ${MODE_LABEL[mode]}`;
}

/** API 모드가 활성인 동안에는 항상 true — 상시 안내 배너 노출 여부(D-09). */
export function shouldShowInlineNotice(mode: LoginMode): boolean {
  return mode === "api";
}

export type TabClickDecision =
  | { action: "none" }
  | { action: "save"; mode: LoginMode }
  | { action: "notice" };

export interface TabClickInput {
  next: LoginMode;
  current: LoginMode;
  lockedByEnv: boolean;
  ackedVersion: number | null;
}

/**
 * 탭 클릭 한 번이 무엇을 해야 하는지 판별한다 — LoginPanel은 이 반환값만 보고
 * 분기하며, 판단 로직을 컴포넌트 안에 남기지 않는다(UI-SPEC Interaction Contract 2).
 *
 * 우선순위: 잠김 → 아무 것도 하지 않음(모달도 IPC도 없음) > 같은 모드 재클릭 →
 * 아무 것도 하지 않음 > API로 전환 + 미확인/구버전 확인 → 모달 > 그 밖의 전환 →
 * 즉시 저장.
 */
export function decideTabClick(input: TabClickInput): TabClickDecision {
  if (input.lockedByEnv) {
    return { action: "none" };
  }
  if (input.next === input.current) {
    return { action: "none" };
  }
  if (input.next === "api") {
    if (shouldShowApiModeNotice(input.ackedVersion, API_MODE_NOTICE_VERSION)) {
      return { action: "notice" };
    }
    return { action: "save", mode: "api" };
  }
  return { action: "save", mode: input.next };
}

export interface FailureView {
  visible: boolean;
  message: string;
  identifier?: string;
  showBrowserSwitch: boolean;
}

const NO_FAILURE: FailureView = {
  visible: false,
  message: "",
  showBrowserSwitch: false,
};

/**
 * 자격증명 로그인 결과를 오류 슬롯 렌더링에 필요한 형태로 정리한다(D-15).
 *
 * 문구는 main이 이미 매핑·마스킹해서 `message`에 실어 보내므로 여기서 다시
 * 만들지 않는다 — `reason`만 `mapLoginFailure()`에 넣어 `suggestBrowserSwitch`만
 * 가져온다(문구를 되파싱하지 않기 위해 `reason`을 계약에 넣었다).
 *
 * `identifier`가 없으면 반환 객체에 그 필드 자체를 담지 않는다 — 렌더러가
 * `(식별자: undefined)`를 찍는 사고를 구조적으로 막는다. 매 호출이 완전히
 * 새로운 객체를 반환하므로 이전 호출의 결과가 누적될 여지가 없다.
 */
export function buildFailureView(result: CredentialLoginResult | null): FailureView {
  if (result === null || result.success) {
    return NO_FAILURE;
  }

  const reason = result.reason ?? "unknown";
  const guidance = mapLoginFailure(reason, result.identifier);

  const view: FailureView = {
    visible: true,
    message: result.message ?? guidance.message,
    showBrowserSwitch: guidance.suggestBrowserSwitch,
  };

  if (result.identifier !== undefined) {
    view.identifier = result.identifier;
  }

  return view;
}
