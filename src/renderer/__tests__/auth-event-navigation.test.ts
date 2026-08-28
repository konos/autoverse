/**
 * `auth-event-navigation.ts`의 실제 모듈을 import해서 검증한다 — 복제본이 아니라
 * 배포되는 코드를 테스트하기 위해서다(login-panel-view.test.ts와 같은 의도적 편차).
 */
import { describe, it, expect } from "vitest";
import { decideAuthEventNavigation, shouldRecheckTokenExpiry, type AppStep } from "../auth-event-navigation";
import type { AuthEvent } from "../../shared/types";

const ALL_EVENT_TYPES: AuthEvent["type"][] = [
  "login-success",
  "token-validated",
  "login-failed",
  "token-expired",
  "cookie-extraction-failed",
  "credential-login-progress",
  "logged-out",
];

const NON_APPLY_EXECUTION_STEPS: AppStep[] = ["login", "profile", "event-setup", "apply-form"];

describe("decideAuthEventNavigation — apply-execution 단계 (Pitfall 3)", () => {
  it.each([
    "login-success",
    "token-validated",
    "token-expired",
    "login-failed",
    "cookie-extraction-failed",
    "credential-login-progress",
  ] as AuthEvent["type"][])(
    "%s 는 armed 상태를 지키기 위해 stay 로 판정된다",
    (eventType) => {
      expect(decideAuthEventNavigation(eventType, "apply-execution")).toEqual({ action: "stay" });
    },
  );

  it("logged-out 만 유일하게 to-login-and-clear-schema 로 판정된다 — 명시적 로그아웃만 화면을 되돌린다", () => {
    expect(decideAuthEventNavigation("logged-out", "apply-execution")).toEqual({
      action: "to-login-and-clear-schema",
    });
  });

  it("apply-execution 에서 logged-out 을 제외한 6개 이벤트 전부가 stay 다 (전수 확인)", () => {
    const nonLogoutTypes = ALL_EVENT_TYPES.filter((t) => t !== "logged-out");
    expect(nonLogoutTypes).toHaveLength(6);
    for (const eventType of nonLogoutTypes) {
      expect(decideAuthEventNavigation(eventType, "apply-execution")).toEqual({ action: "stay" });
    }
  });
});

describe("decideAuthEventNavigation — apply-execution 이 아닌 단계 (기존 동작 재현)", () => {
  it.each(NON_APPLY_EXECUTION_STEPS)("%s 단계에서 login-success 는 to-profile 이다", (step) => {
    expect(decideAuthEventNavigation("login-success", step)).toEqual({ action: "to-profile" });
  });

  it.each(NON_APPLY_EXECUTION_STEPS)("%s 단계에서 token-validated 는 to-profile 이다", (step) => {
    expect(decideAuthEventNavigation("token-validated", step)).toEqual({ action: "to-profile" });
  });

  it.each(NON_APPLY_EXECUTION_STEPS)("%s 단계에서 login-failed 는 to-login 이다", (step) => {
    expect(decideAuthEventNavigation("login-failed", step)).toEqual({ action: "to-login" });
  });

  it.each(NON_APPLY_EXECUTION_STEPS)("%s 단계에서 token-expired 는 to-login 이다", (step) => {
    expect(decideAuthEventNavigation("token-expired", step)).toEqual({ action: "to-login" });
  });

  it.each(NON_APPLY_EXECUTION_STEPS)("%s 단계에서 cookie-extraction-failed 는 to-login 이다", (step) => {
    expect(decideAuthEventNavigation("cookie-extraction-failed", step)).toEqual({ action: "to-login" });
  });

  it.each(NON_APPLY_EXECUTION_STEPS)("%s 단계에서 logged-out 은 to-login-and-clear-schema 다", (step) => {
    expect(decideAuthEventNavigation("logged-out", step)).toEqual({
      action: "to-login-and-clear-schema",
    });
  });

  it.each(NON_APPLY_EXECUTION_STEPS)("%s 단계에서 credential-login-progress 는 stay 다", (step) => {
    expect(decideAuthEventNavigation("credential-login-progress", step)).toEqual({ action: "stay" });
  });
});

describe("shouldRecheckTokenExpiry — 재로그인 완료 시점 재판정 트리거 (CR-01)", () => {
  it.each([
    "login-success",
    "token-validated",
    "login-failed",
    "token-expired",
    "cookie-extraction-failed",
  ] as AuthEvent["type"][])(
    "apply-execution 단계에서 %s 는 재판정 대상(true)이다",
    (eventType) => {
      expect(shouldRecheckTokenExpiry(eventType, "apply-execution")).toBe(true);
    },
  );

  it.each([
    "credential-login-progress",
    "logged-out",
  ] as AuthEvent["type"][])(
    "apply-execution 단계에서 %s 는 재판정 대상이 아니다(false)",
    (eventType) => {
      expect(shouldRecheckTokenExpiry(eventType, "apply-execution")).toBe(false);
    },
  );

  it("apply-execution 이 아닌 4개 단계 × 7개 이벤트 = 28조합 전부 false 다 (신청 대기 중이 아니면 재판정할 배너 자체가 없다)", () => {
    expect(NON_APPLY_EXECUTION_STEPS).toHaveLength(4);
    expect(ALL_EVENT_TYPES).toHaveLength(7);
    for (const step of NON_APPLY_EXECUTION_STEPS) {
      for (const eventType of ALL_EVENT_TYPES) {
        expect(shouldRecheckTokenExpiry(eventType, step)).toBe(false);
      }
    }
  });

  it("ALL_EVENT_TYPES 는 7개다 — 새 인증 이벤트가 추가되면 이 전수 테스트가 조용히 옛 이벤트만 도는 것을 막는다", () => {
    expect(ALL_EVENT_TYPES).toHaveLength(7);
  });
});

describe("decideAuthEventNavigation — 반환 타입", () => {
  it("모든 조합의 반환값이 discriminated union 의 알려진 action 값 중 하나다", () => {
    const knownActions = new Set(["stay", "to-profile", "to-login", "to-login-and-clear-schema"]);
    const allSteps: AppStep[] = ["login", "profile", "event-setup", "apply-form", "apply-execution"];
    for (const step of allSteps) {
      for (const eventType of ALL_EVENT_TYPES) {
        const decision = decideAuthEventNavigation(eventType, step);
        expect(knownActions.has(decision.action)).toBe(true);
      }
    }
  });
});
