---
phase: "02"
plan: "01"
---

# T01: FormSchema 타입 + WeverseApi 클라이언트 + buildApplyPayload 빌더 + form-parser 유틸 구현 — §3.2/§3.3 스펙 완전 준수, 99개 테스트 통과

**FormSchema 타입 + WeverseApi 클라이언트 + buildApplyPayload 빌더 + form-parser 유틸 구현 — §3.2/§3.3 스펙 완전 준수, 99개 테스트 통과**

## What Happened

스펙(weverse-fanevent-apply-spec.md) §3.2~§7을 분석하여 4개 파일을 신규 구현했다.

1. **src/shared/types.ts** — FormSchema, ApplyPeriod, FormConfiguration, Consent, RewardGroup, Reward, ApplyPayload, ApplyPhoneNumber, ApplyReward, ApplyAnswer, StatusResponse, ApplyEvent 등 14개 타입을 기존 types.ts 상단에 추가. applyToken/applyHost 주석으로 '절대 하드코딩 금지' 명시.

2. **src/main/services/weverse-api.ts** — WeverseApi 클래스 3개 메서드 구현:
   - fetchFormSchema: GET /api/fan-api/v1/events/{eventId}/application, 5초 타임아웃, AbortController 사용. 400 APPLICATION_001 → WeverseApiError("APPLICATION_001"), 401 → "토큰 만료" 에러, 네트워크 에러 → "NETWORK_ERROR". Authorization/applyToken 모두 maskToken으로 마스킹 후 로그.
   - submitApplication: POST {applyHost}/apply-api/v1/artists/{artistCode}/events/{eventId}, 10초 타임아웃, X-FEV-APPLY-AUTHENTICATION 헤더 포함. 200 = 큐잉 성공.
   - pollStatus: GET .../status, 5초 타임아웃, REQUESTED/COMPLETED 등 StatusResponse 반환.

3. **src/shared/payload-builder.ts** — buildApplyPayload 순수 함수:
   - parsePhone: '+' 제거, 국가코드(82/1/81 우선 매칭) 분리, 00xx → +xx 정규화, 하이픈 제거, 숫자만 추출.
   - normalizeBirthDate: YYYY-MM-DD / YYYY/MM/DD / YYYYMMDD 세 형식 지원, 하이픈 강제.
   - maxSelectableCount 초과 시 에러, phone 5~13자리 숫자만 검증.

4. **src/shared/form-parser.ts** — validateFormSchema(responseType/applyToken 32자/applyHost https/artistCode/eventPublicId/startAt 검증), isFormOpen(nowMs 주입 가능), getSelectableRewards(isSelectable=true 그룹만 flatten) 구현.

단위 테스트 42개 신규 추가(기존 57개 + 신규 42개 = 99개 전체 통과).

## Verification

1. npx tsc -p tsconfig.main.json --noEmit — 출력 없음(타입 오류 없음)
2. npx tsc --noEmit — 출력 없음(renderer+shared 타입 오류 없음)
3. npm test — 6 test files, 99 tests passed
4. 코드 리뷰: applyHost는 schema.applyHost에서 동적 추출, weverse-api.ts에 하드코딩 없음 확인. Authorization/applyToken 모두 maskToken() 경유 후 로그.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc -p tsconfig.main.json --noEmit` | 0 | pass | 8200ms |
| 2 | `npx tsc --noEmit` | 0 | pass | 7800ms |
| 3 | `npm test` | 0 | pass — 6 files, 99 tests | 4100ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `src/shared/types.ts`
- `src/main/services/weverse-api.ts`
- `src/shared/payload-builder.ts`
- `src/shared/form-parser.ts`
- `src/shared/__tests__/payload-builder.test.ts`
- `src/shared/__tests__/form-parser.test.ts`
