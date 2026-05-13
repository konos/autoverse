import type { FormSchema, Reward } from "./types";

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate FormSchema fields required for submission.
 * Does NOT validate applyPeriod timing — use isFormOpen for that.
 */
export function validateFormSchema(schema: FormSchema): SchemaValidationResult {
  const errors: string[] = [];

  if (schema.responseType !== "available") {
    errors.push(`responseType이 'available'이 아님: '${schema.responseType}'`);
  }

  if (!schema.applyToken || schema.applyToken.length !== 32) {
    errors.push(
      `applyToken 누락 또는 형식 오류 (길이=${schema.applyToken?.length ?? 0}, 32자 필요)`
    );
  }

  if (!schema.applyHost || !schema.applyHost.startsWith("https://")) {
    errors.push(`applyHost 누락 또는 잘못된 형식: '${schema.applyHost}'`);
  }

  if (!schema.artistCode) {
    errors.push("artistCode 누락");
  }

  if (!schema.eventPublicId) {
    errors.push("eventPublicId 누락");
  }

  if (!schema.applyPeriod?.startAt) {
    errors.push("applyPeriod.startAt 누락");
  }

  if (!schema.applyPeriod?.formOpenAt) {
    errors.push("applyPeriod.formOpenAt 누락");
  }

  if (!Array.isArray(schema.consents)) {
    errors.push("consents 필드가 배열이 아님");
  }

  if (!Array.isArray(schema.rewardGroups)) {
    errors.push("rewardGroups 필드가 배열이 아님");
  } else {
    schema.rewardGroups.forEach((g, i) => {
      if (typeof g.id !== "number") {
        errors.push(`rewardGroups[${i}].id가 숫자가 아님`);
      }
      if (!Array.isArray(g.rewards)) {
        errors.push(`rewardGroups[${i}].rewards가 배열이 아님`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Returns true if the current local time is after formOpenAt.
 * Pass a custom `nowMs` for testability.
 */
export function isFormOpen(schema: FormSchema, nowMs = Date.now()): boolean {
  const formOpenAt = schema.applyPeriod?.formOpenAt;
  if (!formOpenAt) return false;
  return nowMs >= new Date(formOpenAt).getTime();
}

/**
 * Returns all rewards from groups where isSelectable === true.
 */
export function getSelectableRewards(schema: FormSchema): Reward[] {
  if (!Array.isArray(schema.rewardGroups)) return [];
  return schema.rewardGroups
    .filter((g) => g.isSelectable)
    .flatMap((g) => g.rewards);
}
