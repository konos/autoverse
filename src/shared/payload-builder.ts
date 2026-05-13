import type { FormSchema, ApplyPayload, ApplyReward, ApplyAnswer } from "./types";
import type { Profile } from "./types";

export interface RewardSelection {
  rewardGroupId: number;
  rewardIds: number[];
}

export interface BuildPayloadInput {
  schema: FormSchema;
  profile: Profile;
  /** User-confirmed reward selections per group */
  rewardSelections: RewardSelection[];
  /** All consent IDs that the user has explicitly agreed to */
  consentIds: number[];
  /** Answers to additional questions (empty if schema has none) */
  answers?: ApplyAnswer[];
}

/**
 * Parse phone number into country code + local number per §7 rules.
 * Strips '+', separates country code from subscriber number, strips hyphens.
 * Assumes Korean (+82) if no explicit country code prefix is detectable.
 */
export function parsePhone(raw: string): {
  phoneCountryCode: string;
  phoneNumber: string;
} {
  // Remove all whitespace
  const cleaned = raw.replace(/\s/g, "");

  let withPlus = cleaned;
  // Normalize leading 00 → +
  if (withPlus.startsWith("00")) {
    withPlus = "+" + withPlus.slice(2);
  }

  if (withPlus.startsWith("+")) {
    // Extract country code (1–3 digits after +)
    // Known prefixes by length: try 3, 2, 1 digit
    const digits = withPlus.slice(1).replace(/-/g, "");
    // Korean +82
    if (digits.startsWith("82")) {
      return { phoneCountryCode: "82", phoneNumber: digits.slice(2) };
    }
    // US/CA +1
    if (digits.startsWith("1")) {
      return { phoneCountryCode: "1", phoneNumber: digits.slice(1) };
    }
    // Japan +81
    if (digits.startsWith("81")) {
      return { phoneCountryCode: "81", phoneNumber: digits.slice(2) };
    }
    // Fallback: 2-digit country code
    return { phoneCountryCode: digits.slice(0, 2), phoneNumber: digits.slice(2) };
  }

  // No prefix → assume Korea (82)
  // Remove hyphens, keep digits only
  const digitsOnly = cleaned.replace(/-/g, "").replace(/[^\d]/g, "");
  return { phoneCountryCode: "82", phoneNumber: digitsOnly };
}

/**
 * Normalize birthDate to YYYY-MM-DD format (§7 rule: hyphens, not slashes).
 * Accepts: YYYY-MM-DD, YYYY/MM/DD, YYYYMMDD.
 */
export function normalizeBirthDate(raw: string): string {
  const s = raw.trim();
  // Already correct format
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Slash format: YYYY/MM/DD
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, "-");
  // No separator: YYYYMMDD
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  throw new Error(`birthDate 형식 오류: '${raw}' — YYYY-MM-DD 형식 필요`);
}

/**
 * Build the POST body per §3.3 and §7 rules.
 * Pure function — no side effects, no logging (PII in args).
 */
export function buildApplyPayload(input: BuildPayloadInput): ApplyPayload {
  const { schema, profile, rewardSelections, consentIds, answers = [] } = input;

  if (!profile.phone) {
    throw new Error("전화번호가 필요합니다");
  }
  if (!profile.birthDate) {
    throw new Error("생년월일이 필요합니다");
  }

  const { phoneCountryCode, phoneNumber } = parsePhone(profile.phone);
  const birthDate = normalizeBirthDate(profile.birthDate);

  // Validate phone number is digits only, 5–13 chars (§7)
  if (!/^\d{5,13}$/.test(phoneNumber)) {
    throw new Error(
      `전화번호 형식 오류: 숫자만, 5~13자리 필요 (입력값 length=${phoneNumber.length})`
    );
  }

  // Build rewards array — enforce maxSelectableCount per group
  const applyRewards: ApplyReward[] = rewardSelections.map((sel) => {
    const group = schema.rewardGroups.find((g) => g.id === sel.rewardGroupId);
    if (group && sel.rewardIds.length > group.maxSelectableCount) {
      throw new Error(
        `rewardGroup ${sel.rewardGroupId}: 최대 ${group.maxSelectableCount}개 선택 가능 (요청 ${sel.rewardIds.length}개)`
      );
    }
    return { rewardGroupId: sel.rewardGroupId, rewardIds: sel.rewardIds };
  });

  return {
    artistCode: schema.artistCode,
    eventPublicId: schema.eventPublicId,
    application: {
      birthDate,
      applicantPhoneNumber: { phoneCountryCode, phoneNumber },
      applicationConsentIds: consentIds,
      applyRewards,
      answers,
    },
  };
}
