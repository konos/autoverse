import { describe, it, expect } from "vitest";
import { validateFormSchema, isFormOpen, getSelectableRewards } from "../form-parser";
import type { FormSchema } from "../types";

// ── Fixture ───────────────────────────────────────────────────────────────────

const baseSchema: FormSchema = {
  eventPublicId: "66195918a9c0",
  artistName: "NCT WISH",
  artistCode: "NCTWISH",
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
    title: { ko: "테스트" },
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
    {
      id: 3900,
      type: "OTHER",
      title: { ko: "비선택 그룹" },
      useCheckIn: false,
      isSelectable: false,
      maxSelectableCount: 0,
      order: 1,
      rewards: [{ id: 5000, type: "OTHER", title: { ko: "항목" } }],
    },
  ],
  applyToken: "0412780eba2a0000000000000000abcd", // 32 chars
  applyHost: "https://fanevent-v2-apply-04.weverse.io",
  responseType: "available",
};

// ── validateFormSchema ────────────────────────────────────────────────────────

describe("validateFormSchema", () => {
  it("valid schema → valid=true, no errors", () => {
    const result = validateFormSchema(baseSchema);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("responseType !== 'available' → error", () => {
    const schema = { ...baseSchema, responseType: "closed" };
    const result = validateFormSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("responseType"))).toBe(true);
  });

  it("applyToken missing → error", () => {
    const schema = { ...baseSchema, applyToken: "" };
    const result = validateFormSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("applyToken"))).toBe(true);
  });

  it("applyToken wrong length → error", () => {
    const schema = { ...baseSchema, applyToken: "shorttoken" };
    const result = validateFormSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("applyToken"))).toBe(true);
  });

  it("applyHost not https → error", () => {
    const schema = { ...baseSchema, applyHost: "http://fanevent-v2-apply-04.weverse.io" };
    const result = validateFormSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("applyHost"))).toBe(true);
  });

  it("applyHost missing → error", () => {
    const schema = { ...baseSchema, applyHost: "" };
    const result = validateFormSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("applyHost"))).toBe(true);
  });

  it("missing artistCode → error", () => {
    const schema = { ...baseSchema, artistCode: "" };
    const result = validateFormSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("artistCode"))).toBe(true);
  });

  it("missing eventPublicId → error", () => {
    const schema = { ...baseSchema, eventPublicId: "" };
    const result = validateFormSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("eventPublicId"))).toBe(true);
  });

  it("missing startAt → error", () => {
    const schema = {
      ...baseSchema,
      applyPeriod: { ...baseSchema.applyPeriod, startAt: "" },
    };
    const result = validateFormSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("startAt"))).toBe(true);
  });

  it("multiple errors reported together", () => {
    const schema = {
      ...baseSchema,
      responseType: "unavailable",
      applyToken: "",
      applyHost: "",
    };
    const result = validateFormSchema(schema);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ── isFormOpen ────────────────────────────────────────────────────────────────

describe("isFormOpen", () => {
  const formOpenAt = new Date("2026-05-11T11:55:00Z").getTime();

  it("before formOpenAt → false", () => {
    expect(isFormOpen(baseSchema, formOpenAt - 1)).toBe(false);
  });

  it("exactly at formOpenAt → true", () => {
    expect(isFormOpen(baseSchema, formOpenAt)).toBe(true);
  });

  it("after formOpenAt → true", () => {
    expect(isFormOpen(baseSchema, formOpenAt + 60_000)).toBe(true);
  });

  it("missing formOpenAt → false", () => {
    const schema = {
      ...baseSchema,
      applyPeriod: { ...baseSchema.applyPeriod, formOpenAt: "" },
    };
    expect(isFormOpen(schema, formOpenAt + 9999)).toBe(false);
  });

  it("uses Date.now() when nowMs omitted — schema in past → true", () => {
    // formOpenAt is 2026-05-11 which is in the past relative to test execution date
    expect(isFormOpen(baseSchema)).toBe(true);
  });
});

// ── getSelectableRewards ──────────────────────────────────────────────────────

describe("getSelectableRewards", () => {
  it("returns only rewards from isSelectable=true groups", () => {
    const rewards = getSelectableRewards(baseSchema);
    expect(rewards.map((r) => r.id)).toEqual([4116, 4117]);
  });

  it("empty rewardGroups → empty array", () => {
    const schema = { ...baseSchema, rewardGroups: [] };
    expect(getSelectableRewards(schema)).toEqual([]);
  });

  it("all groups non-selectable → empty array", () => {
    const schema = {
      ...baseSchema,
      rewardGroups: baseSchema.rewardGroups.map((g) => ({
        ...g,
        isSelectable: false,
      })),
    };
    expect(getSelectableRewards(schema)).toEqual([]);
  });

  it("multiple selectable groups → all rewards combined", () => {
    const schema = {
      ...baseSchema,
      rewardGroups: [
        { ...baseSchema.rewardGroups[0], isSelectable: true },
        {
          ...baseSchema.rewardGroups[1],
          isSelectable: true,
          rewards: [{ id: 5000, type: "OTHER", title: { ko: "항목" } }],
        },
      ],
    };
    const rewards = getSelectableRewards(schema);
    expect(rewards.map((r) => r.id)).toEqual([4116, 4117, 5000]);
  });
});
