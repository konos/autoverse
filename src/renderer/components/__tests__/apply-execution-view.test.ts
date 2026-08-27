/**
 * `apply-execution-view.ts`의 실제 모듈을 import해서 검증한다 — 복제본이
 * 아니라 배포되는 코드를 테스트하기 위해서다(login-panel-view.test.ts와
 * 동일한 관례).
 */
import { describe, it, expect } from "vitest";
import { describeTokenExpiryNotice } from "../apply-execution-view";
import type { TokenExpiryState } from "../../../shared/token-expiry";

describe("describeTokenExpiryNotice", () => {
  it("safe → visible=false, 배너 자체가 렌더링되지 않는다", () => {
    const state: TokenExpiryState = { status: "safe" };
    const notice = describeTokenExpiryNotice(state);

    expect(notice.visible).toBe(false);
    expect("expAt" in notice).toBe(false);
  });

  it("warning → visible=true, showRelogin=true, expAt이 입력값과 같다", () => {
    const state: TokenExpiryState = { status: "warning", expAt: 1_700_000_000_000 };
    const notice = describeTokenExpiryNotice(state);

    expect(notice.visible).toBe(true);
    expect(notice.tone).toBe("warning");
    expect(notice.showRelogin).toBe(true);
    expect(notice.expAt).toBe(1_700_000_000_000);
    expect(notice.message).toBe(
      "대기 중 토큰이 만료될 수 있습니다 — 신청 전에 다시 로그인해주세요.",
    );
  });

  it("unknown → visible=true, showRelogin=true, expAt 키가 아예 없다", () => {
    const state: TokenExpiryState = { status: "unknown" };
    const notice = describeTokenExpiryNotice(state);

    expect(notice.visible).toBe(true);
    expect(notice.tone).toBe("info");
    expect(notice.showRelogin).toBe(true);
    expect("expAt" in notice).toBe(false);
    expect(notice.message).toBe(
      "토큰 만료 시각을 확인할 수 없습니다 — 신청 직전에 로그인 상태를 확인해주세요.",
    );
  });

  it("어떤 상태에서도 blocking 류 필드를 반환하지 않는다 (D-12)", () => {
    const states: TokenExpiryState[] = [
      { status: "safe" },
      { status: "warning", expAt: 1 },
      { status: "unknown" },
    ];
    for (const state of states) {
      const notice = describeTokenExpiryNotice(state);
      expect(Object.keys(notice)).not.toContain("blocking");
    }
  });
});
