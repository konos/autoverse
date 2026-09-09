import { describe, it, expect } from "vitest";
import {
  parsePhone,
  normalizeBirthDate,
  buildApplyPayload,
  type RewardSelection,
} from "../payload-builder";
import type { FormSchema, Profile } from "../types";

// ── Fixture ───────────────────────────────────────────────────────────────────

const baseSchema: FormSchema = {
  eventPublicId: "aabbccddee00",
  artistName: "TEST ARTIST",
  artistCode: "TESTART",
  officialMembershipResponse: [],
  languages: ["ko"],
  primaryLanguage: "ko",
  applyPeriod: {
    formOpenAt: "2026-05-11T11:55:00Z",
    startAt: "2026-05-11T12:00:00Z",
    endAt: "2026-05-11T12:10:00Z",
  },
  requiresShopPurchaseConsent: false,
  applyType: "FIFO",
  display: {
    headerImageUrl: null,
    title: { ko: "테스트 이벤트" },
    description: { ko: "" },
    material: { ko: "" },
  },
  formConfiguration: [
    {
      useName: false,
      useMiddleName: false,
      useBirthDate: true,
      usePhone: true,
      messengers: null,
      minAge: 14,
      questions: [],
    },
  ],
  consents: [
    { id: 3983, title: { ko: "동의1" }, body: { ko: "" }, order: 0 },
    { id: 3984, title: { ko: "동의2" }, body: { ko: "" }, order: 1 },
  ],
  rewardGroups: [
    {
      id: 3895,
      type: "ROUND",
      title: { ko: "회차 선택" },
      useCheckIn: true,
      isSelectable: true,
      maxSelectableCount: 1,
      order: 0,
      rewards: [
        { id: 4116, type: "ROUND", title: { ko: "1회차" } },
        { id: 4117, type: "ROUND", title: { ko: "2회차" } },
      ],
    },
  ],
  applyToken: "0412780eba2a0000000000000000abcd", // 32 chars
  applyHost: "https://fanevent-v2-apply-04.weverse.io",
  responseType: "available",
};

const baseProfile: Profile = {
  fanId: 1234567,
  phone: "01012345678",
  birthDate: "2000-01-15",
};

const baseRewards: RewardSelection[] = [{ rewardGroupId: 3895, rewardIds: [4116] }];

// ── parsePhone ────────────────────────────────────────────────────────────────

describe("parsePhone", () => {
  it("digits only → KR 82 assumed", () => {
    const r = parsePhone("01012345678");
    expect(r).toEqual({ phoneCountryCode: "82", phoneNumber: "01012345678" });
  });

  it("strips hyphens from local number", () => {
    const r = parsePhone("010-1234-5678");
    expect(r).toEqual({ phoneCountryCode: "82", phoneNumber: "01012345678" });
  });

  it("+82 prefix stripped correctly", () => {
    const r = parsePhone("+821012345678");
    expect(r).toEqual({ phoneCountryCode: "82", phoneNumber: "1012345678" });
  });

  it("+82 with hyphens stripped", () => {
    const r = parsePhone("+82-10-1234-5678");
    expect(r).toEqual({ phoneCountryCode: "82", phoneNumber: "1012345678" });
  });

  it("+1 US number", () => {
    const r = parsePhone("+12125550100");
    expect(r).toEqual({ phoneCountryCode: "1", phoneNumber: "2125550100" });
  });

  it("+81 Japan number", () => {
    const r = parsePhone("+819012345678");
    expect(r).toEqual({ phoneCountryCode: "81", phoneNumber: "9012345678" });
  });

  it("0082 prefix normalised to +82", () => {
    const r = parsePhone("00821012345678");
    expect(r).toEqual({ phoneCountryCode: "82", phoneNumber: "1012345678" });
  });
});

// ── normalizeBirthDate ────────────────────────────────────────────────────────

describe("normalizeBirthDate", () => {
  it("already YYYY-MM-DD → unchanged", () => {
    expect(normalizeBirthDate("2000-01-15")).toBe("2000-01-15");
  });

  it("slash format → hyphens", () => {
    expect(normalizeBirthDate("2000/01/15")).toBe("2000-01-15");
  });

  it("no separator YYYYMMDD → YYYY-MM-DD", () => {
    expect(normalizeBirthDate("20000115")).toBe("2000-01-15");
  });

  it("invalid format → throws", () => {
    expect(() => normalizeBirthDate("00-01-15")).toThrow("birthDate 형식 오류");
    expect(() => normalizeBirthDate("2000.01.15")).toThrow("birthDate 형식 오류");
  });
});

// ── buildApplyPayload — golden path ───────────────────────────────────────────

describe("buildApplyPayload — golden path", () => {
  it("produces exact §3.3 structure", () => {
    const payload = buildApplyPayload({
      schema: baseSchema,
      profile: baseProfile,
      rewardSelections: baseRewards,
      consentIds: [3983, 3984],
    });

    expect(payload).toEqual({
      artistCode: "TESTART",
      eventPublicId: "aabbccddee00",
      application: {
        birthDate: "2000-01-15",
        applicantPhoneNumber: {
          phoneCountryCode: "82",
          phoneNumber: "01012345678",
        },
        applicationConsentIds: [3983, 3984],
        applyRewards: [{ rewardGroupId: 3895, rewardIds: [4116] }],
        answers: [],
      },
    });
  });

  it("normalises slash birthDate", () => {
    const payload = buildApplyPayload({
      schema: baseSchema,
      profile: { ...baseProfile, birthDate: "2000/01/15" },
      rewardSelections: baseRewards,
      consentIds: [3983, 3984],
    });
    expect(payload.application.birthDate).toBe("2000-01-15");
  });

  it("strips hyphens from phone", () => {
    const payload = buildApplyPayload({
      schema: baseSchema,
      profile: { ...baseProfile, phone: "010-1234-5678" },
      rewardSelections: baseRewards,
      consentIds: [3983, 3984],
    });
    expect(payload.application.applicantPhoneNumber.phoneNumber).toBe("01012345678");
    expect(payload.application.applicantPhoneNumber.phoneCountryCode).toBe("82");
  });

  it("empty rewardSelections → empty applyRewards", () => {
    const payload = buildApplyPayload({
      schema: baseSchema,
      profile: baseProfile,
      rewardSelections: [],
      consentIds: [3983, 3984],
    });
    expect(payload.application.applyRewards).toEqual([]);
  });

  it("single consent in array", () => {
    const payload = buildApplyPayload({
      schema: baseSchema,
      profile: baseProfile,
      rewardSelections: baseRewards,
      consentIds: [3983],
    });
    expect(payload.application.applicationConsentIds).toEqual([3983]);
  });

  it("empty consentIds → empty array", () => {
    const payload = buildApplyPayload({
      schema: baseSchema,
      profile: baseProfile,
      rewardSelections: baseRewards,
      consentIds: [],
    });
    expect(payload.application.applicationConsentIds).toEqual([]);
  });

  it("passes answers when provided", () => {
    const answers = [{ questionId: 1, answer: "yes" }];
    const payload = buildApplyPayload({
      schema: baseSchema,
      profile: baseProfile,
      rewardSelections: baseRewards,
      consentIds: [3983, 3984],
      answers,
    });
    expect(payload.application.answers).toEqual(answers);
  });
});

// ── buildApplyPayload — negative / boundary cases ─────────────────────────────

describe("buildApplyPayload — error paths", () => {
  it("missing phone → throws", () => {
    expect(() =>
      buildApplyPayload({
        schema: baseSchema,
        profile: { ...baseProfile, phone: undefined },
        rewardSelections: baseRewards,
        consentIds: [3983, 3984],
      })
    ).toThrow("전화번호가 필요합니다");
  });

  it("missing birthDate → throws", () => {
    expect(() =>
      buildApplyPayload({
        schema: baseSchema,
        profile: { ...baseProfile, birthDate: undefined },
        rewardSelections: baseRewards,
        consentIds: [3983, 3984],
      })
    ).toThrow("생년월일이 필요합니다");
  });

  it("exceeds maxSelectableCount → throws", () => {
    expect(() =>
      buildApplyPayload({
        schema: baseSchema,
        profile: baseProfile,
        rewardSelections: [{ rewardGroupId: 3895, rewardIds: [4116, 4117] }], // max=1
        consentIds: [3983, 3984],
      })
    ).toThrow("최대 1개 선택 가능");
  });

  it("phone too short → throws after parsing", () => {
    expect(() =>
      buildApplyPayload({
        schema: baseSchema,
        profile: { ...baseProfile, phone: "1234" }, // 4 digits — too short
        rewardSelections: baseRewards,
        consentIds: [3983, 3984],
      })
    ).toThrow("전화번호 형식 오류");
  });

  it("invalid birthDate format → throws", () => {
    expect(() =>
      buildApplyPayload({
        schema: baseSchema,
        profile: { ...baseProfile, birthDate: "2000.01.15" },
        rewardSelections: baseRewards,
        consentIds: [3983, 3984],
      })
    ).toThrow("birthDate 형식 오류");
  });
});
