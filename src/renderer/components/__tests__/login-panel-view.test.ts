/**
 * `login-panel-view.ts`의 실제 모듈을 import해서 검증한다 — 복제본이 아니라
 * 배포되는 코드를 테스트하기 위해서다(이 저장소의 기존 관례와의 의도적 편차).
 */
import { describe, it, expect } from "vitest";
import {
  resolveTabView,
  describeLockedMode,
  shouldShowInlineNotice,
  decideTabClick,
  buildFailureView,
  decideNoticeCancel,
  resolveStoredLoginState,
} from "../login-panel-view";
import { API_MODE_NOTICE_VERSION } from "../../../shared/api-mode-notice";
import type { CredentialLoginResult, StoredCredentialsSnapshot } from "../../../shared/types";

describe("resolveTabView", () => {
  it("잠금이 없으면 활성 탭만 지정되고 두 탭 모두 조작 가능하다", () => {
    const view = resolveTabView("api", false);
    expect(view.active).toBe("api");
    expect(view.tabsDisabled).toBe(false);
    expect(view.showBadge).toBe(false);
  });

  it("환경변수로 잠기면 활성 탭은 유지되지만 두 탭 모두 비활성이고 배지가 표시된다", () => {
    const view = resolveTabView("browser", true);
    expect(view.active).toBe("browser");
    expect(view.tabsDisabled).toBe(true);
    expect(view.showBadge).toBe(true);
  });
});

describe("describeLockedMode", () => {
  it("api 모드일 때 상세 문구에 'API 로그인' 라벨이 들어간다", () => {
    const text = describeLockedMode("api");
    expect(text).toContain("API 로그인");
    expect(text).not.toContain("browser");
    expect(text).not.toContain("AUTOVERSE_LOGIN_MODE=");
  });

  it("browser 모드일 때 상세 문구에 '브라우저 로그인' 라벨이 들어간다", () => {
    const text = describeLockedMode("browser");
    expect(text).toContain("브라우저 로그인");
  });

  it("환경변수 원문 값이 출력에 등장하지 않는다 — 고정 라벨만 끼워 넣는다", () => {
    expect(describeLockedMode("api")).not.toMatch(/=(api|browser)/);
  });
});

describe("shouldShowInlineNotice", () => {
  it("api 모드에서는 상시 안내가 노출된다", () => {
    expect(shouldShowInlineNotice("api")).toBe(true);
  });

  it("browser 모드에서는 상시 안내가 노출되지 않는다", () => {
    expect(shouldShowInlineNotice("browser")).toBe(false);
  });
});

describe("decideTabClick", () => {
  it("browser → api, 미확인(ackedVersion null) → 모달을 열어야 한다", () => {
    const decision = decideTabClick({
      next: "api",
      current: "browser",
      lockedByEnv: false,
      ackedVersion: null,
    });
    expect(decision).toEqual({ action: "notice" });
  });

  it("browser → api, 현재 버전까지 이미 확인 → 모달 없이 즉시 저장", () => {
    const decision = decideTabClick({
      next: "api",
      current: "browser",
      lockedByEnv: false,
      ackedVersion: API_MODE_NOTICE_VERSION,
    });
    expect(decision).toEqual({ action: "save", mode: "api" });
  });

  it("browser → api, 구버전만 확인 → 재확인을 위해 모달을 열어야 한다", () => {
    const decision = decideTabClick({
      next: "api",
      current: "browser",
      lockedByEnv: false,
      ackedVersion: API_MODE_NOTICE_VERSION - 1,
    });
    expect(decision).toEqual({ action: "notice" });
  });

  it("이미 활성인 탭을 다시 클릭하면 아무 것도 하지 않는다", () => {
    const decision = decideTabClick({
      next: "api",
      current: "api",
      lockedByEnv: false,
      ackedVersion: null,
    });
    expect(decision).toEqual({ action: "none" });
  });

  it("api → browser 전환은 고지 대상이 아니므로 모달 없이 즉시 저장한다", () => {
    const decision = decideTabClick({
      next: "browser",
      current: "api",
      lockedByEnv: false,
      ackedVersion: null,
    });
    expect(decision).toEqual({ action: "save", mode: "browser" });
  });

  it("환경변수로 잠긴 상태에서는 어떤 입력이든 아무 것도 하지 않는다 (IPC도 모달도 없음)", () => {
    const decision = decideTabClick({
      next: "api",
      current: "browser",
      lockedByEnv: true,
      ackedVersion: null,
    });
    expect(decision).toEqual({ action: "none" });
  });

  it("잠긴 상태에서 이미 확인된 버전이라도 여전히 아무 것도 하지 않는다", () => {
    const decision = decideTabClick({
      next: "browser",
      current: "api",
      lockedByEnv: true,
      ackedVersion: API_MODE_NOTICE_VERSION,
    });
    expect(decision).toEqual({ action: "none" });
  });
});

describe("buildFailureView", () => {
  it("captcha 사유는 전환 버튼을 노출해야 한다", () => {
    const result: CredentialLoginResult = {
      success: false,
      reason: "captcha",
      message: "Weverse가 보안 확인을 요구해 앱 안 로그인으로는 진행할 수 없습니다. 브라우저 로그인을 사용해주세요.",
    };
    const view = buildFailureView(result);
    expect(view.visible).toBe(true);
    expect(view.showBrowserSwitch).toBe(true);
    expect(view.identifier).toBeUndefined();
  });

  it("form-error 사유는 전환 버튼도 칩도 없다", () => {
    const result: CredentialLoginResult = {
      success: false,
      reason: "form-error",
      message: "이미 등록된 이메일입니다.",
    };
    const view = buildFailureView(result);
    expect(view.visible).toBe(true);
    expect(view.showBrowserSwitch).toBe(false);
    expect(view.identifier).toBeUndefined();
  });

  it("network-error 사유는 칩 텍스트에 식별자가 포함된다", () => {
    const result: CredentialLoginResult = {
      success: false,
      reason: "network-error",
      message: "네트워크 오류로 로그인에 실패했습니다. 인터넷 연결을 확인한 뒤 다시 시도해주세요.",
      identifier: "ECONNRESET",
    };
    const view = buildFailureView(result);
    expect(view.visible).toBe(true);
    expect(view.identifier).toBe("ECONNRESET");
  });

  it("unknown 사유에서 identifier가 없으면 칩 관련 필드 자체가 결과에 없다", () => {
    const result: CredentialLoginResult = {
      success: false,
      reason: "unknown",
      message: "로그인에 실패했습니다. 로그 패널에서 자세한 내용을 확인하세요.",
    };
    const view = buildFailureView(result);
    expect(view.visible).toBe(true);
    expect("identifier" in view).toBe(false);
  });

  it("성공 결과는 표시할 것이 없다", () => {
    const view = buildFailureView({ success: true });
    expect(view.visible).toBe(false);
  });

  it("null 결과도 표시할 것이 없다", () => {
    const view = buildFailureView(null);
    expect(view.visible).toBe(false);
  });

  it("연속으로 두 번 계산해도 이전 결과가 누적되지 않는다 — 항상 최신 하나만 반영한다", () => {
    const first = buildFailureView({
      success: false,
      reason: "network-error",
      message: "첫 번째 실패",
      identifier: "first-id",
    });
    const second = buildFailureView({
      success: false,
      reason: "captcha",
      message: "두 번째 실패",
    });
    expect(first.identifier).toBe("first-id");
    expect(second.identifier).toBeUndefined();
    expect(second.showBrowserSwitch).toBe(true);
  });
});

describe("decideNoticeCancel", () => {
  it("저장이 진행 중이면 취소를 무시한다 (WR-01)", () => {
    expect(decideNoticeCancel(true)).toBe("ignore");
  });

  it("저장이 진행 중이 아니면 닫는다", () => {
    expect(decideNoticeCancel(false)).toBe("close");
  });
});

describe("resolveStoredLoginState", () => {
  const NONE: StoredCredentialsSnapshot = { state: "none" };
  const AVAILABLE: StoredCredentialsSnapshot = { state: "available", email: "kim@weverse.io" };
  const CORRUPTED: StoredCredentialsSnapshot = { state: "corrupted" };
  const UNAVAILABLE: StoredCredentialsSnapshot = { state: "unavailable" };

  it("none: 상태문·삭제 버튼·보조 버튼·안내 모두 없다", () => {
    const view = resolveStoredLoginState(NONE, "");
    expect(view.statusLine).toBeNull();
    expect(view.showClearButton).toBe(false);
    expect(view.showStoredLoginButton).toBe(false);
    expect(view.storedLoginEnabled).toBe(false);
    expect(view.notice).toBeNull();
  });

  it("available + 이메일 일치: 상태문·삭제 버튼·보조 버튼 노출, 보조 버튼 활성, 안내 없음", () => {
    const view = resolveStoredLoginState(AVAILABLE, "kim@weverse.io");
    expect(view.statusLine).not.toBeNull();
    expect(view.showClearButton).toBe(true);
    expect(view.showStoredLoginButton).toBe(true);
    expect(view.storedLoginEnabled).toBe(true);
    expect(view.notice).toBeNull();
  });

  it("available + 대소문자만 다른 이메일: 일치로 판정되어 보조 버튼이 활성이다", () => {
    const view = resolveStoredLoginState(AVAILABLE, "KIM@Weverse.io");
    expect(view.storedLoginEnabled).toBe(true);
    expect(view.notice).toBeNull();
  });

  it("available + 앞뒤 공백만 다른 이메일: 일치로 판정되어 보조 버튼이 활성이다", () => {
    const view = resolveStoredLoginState(AVAILABLE, "  kim@weverse.io  ");
    expect(view.storedLoginEnabled).toBe(true);
    expect(view.notice).toBeNull();
  });

  it("available + 다른 이메일: 상태문·삭제·보조 버튼은 그대로 있으나 보조 버튼은 비활성, '다른 계정입니다' 안내", () => {
    const view = resolveStoredLoginState(AVAILABLE, "other@weverse.io");
    expect(view.statusLine).not.toBeNull();
    expect(view.showClearButton).toBe(true);
    expect(view.showStoredLoginButton).toBe(true);
    expect(view.storedLoginEnabled).toBe(false);
    expect(view.notice).toBe("다른 계정입니다 — 비밀번호를 입력하세요.");
  });

  it("available + 공백뿐인 입력: 보조 버튼 비활성이지만 안내는 없다(입력 중인 상태를 오류로 표시하지 않는다)", () => {
    const view = resolveStoredLoginState(AVAILABLE, "   ");
    expect(view.storedLoginEnabled).toBe(false);
    expect(view.notice).toBeNull();
    expect(view.showStoredLoginButton).toBe(true);
  });

  it("available 상태문에는 원문 이메일이 그대로 나타나지 않고 마스킹된 형태만 나타난다", () => {
    const view = resolveStoredLoginState(AVAILABLE, "kim@weverse.io");
    expect(view.statusLine).not.toContain("kim@weverse.io");
    expect(view.statusLine).toContain("k**@weverse.io");
  });

  it("corrupted: 상태문·삭제·보조 버튼 모두 없고, 초기화 안내가 뜬다", () => {
    const view = resolveStoredLoginState(CORRUPTED, "");
    expect(view.statusLine).toBeNull();
    expect(view.showClearButton).toBe(false);
    expect(view.showStoredLoginButton).toBe(false);
    expect(view.notice).toBe("저장된 로그인 정보를 읽지 못해 초기화했습니다 — 다시 입력해주세요.");
  });

  it("unavailable: 상태문·보조 버튼은 없지만 삭제 버튼은 있다(파일 보존, 출구 필요)", () => {
    const view = resolveStoredLoginState(UNAVAILABLE, "");
    expect(view.statusLine).toBeNull();
    expect(view.showClearButton).toBe(true);
    expect(view.showStoredLoginButton).toBe(false);
    expect(view.notice).toBe("이 환경에서는 저장된 정보를 사용할 수 없습니다 — 비밀번호를 입력해주세요.");
  });
});
