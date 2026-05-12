/**
 * Unit tests for ProfileForm validation logic.
 * Run with: npx ts-node src/renderer/components/__tests__/profile-form-validation.test.ts
 */

interface FormState {
  birthDate: string;
  phoneCountryCode: string;
  phoneNumber: string;
}

function validate(form: FormState): string | null {
  if (!form.birthDate) return "생년월일을 입력해주세요.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate))
    return "생년월일 형식이 올바르지 않습니다 (YYYY-MM-DD).";
  if (!form.phoneNumber) return "전화번호를 입력해주세요.";
  if (!/^\d{9,11}$/.test(form.phoneNumber.replace(/-/g, "")))
    return "전화번호 형식이 올바르지 않습니다.";
  return null;
}

let passed = 0;
let failed = 0;

function assert(desc: string, actual: string | null, expected: string | null) {
  if (actual === expected) {
    console.log(`  ✓ ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ ${desc}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

console.log("ProfileForm validation — negative test suite\n");

// Valid input
assert(
  "valid form passes",
  validate({ birthDate: "1995-03-14", phoneCountryCode: "+82", phoneNumber: "01012345678" }),
  null,
);

// birthDate errors
assert(
  "empty birthDate → error",
  validate({ birthDate: "", phoneCountryCode: "+82", phoneNumber: "01012345678" }),
  "생년월일을 입력해주세요.",
);
assert(
  "wrong date format → error",
  validate({ birthDate: "19950314", phoneCountryCode: "+82", phoneNumber: "01012345678" }),
  "생년월일 형식이 올바르지 않습니다 (YYYY-MM-DD).",
);
assert(
  "partial date → error",
  validate({ birthDate: "1995-03", phoneCountryCode: "+82", phoneNumber: "01012345678" }),
  "생년월일 형식이 올바르지 않습니다 (YYYY-MM-DD).",
);
assert(
  "letters in date → error",
  validate({ birthDate: "YYYY-MM-DD", phoneCountryCode: "+82", phoneNumber: "01012345678" }),
  "생년월일 형식이 올바르지 않습니다 (YYYY-MM-DD).",
);

// phoneNumber errors
assert(
  "empty phone → error",
  validate({ birthDate: "1995-03-14", phoneCountryCode: "+82", phoneNumber: "" }),
  "전화번호를 입력해주세요.",
);
assert(
  "too short phone (8 digits) → error",
  validate({ birthDate: "1995-03-14", phoneCountryCode: "+82", phoneNumber: "12345678" }),
  "전화번호 형식이 올바르지 않습니다.",
);
assert(
  "too long phone (12 digits) → error",
  validate({ birthDate: "1995-03-14", phoneCountryCode: "+82", phoneNumber: "123456789012" }),
  "전화번호 형식이 올바르지 않습니다.",
);
assert(
  "phone with dashes (valid after strip)",
  validate({ birthDate: "1995-03-14", phoneCountryCode: "+82", phoneNumber: "010-1234-5678" }),
  null,
);
assert(
  "letters in phone → error",
  validate({ birthDate: "1995-03-14", phoneCountryCode: "+82", phoneNumber: "0101234abcd" }),
  "전화번호 형식이 올바르지 않습니다.",
);

// Boundary — minimum 9 digit phone
assert(
  "9-digit phone (min valid)",
  validate({ birthDate: "1995-03-14", phoneCountryCode: "+1", phoneNumber: "123456789" }),
  null,
);
// Maximum 11 digit phone
assert(
  "11-digit phone (max valid)",
  validate({ birthDate: "1995-03-14", phoneCountryCode: "+82", phoneNumber: "01012345678" }),
  null,
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
