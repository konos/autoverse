---
phase: "02"
plan: "05"
---

# T05: 단위 테스트 3종(payload-builder, timing-service, form-parser) 136개 전부 통과 — 스펙 §3.3 deep-equal, 오프셋 보정, 시간 가드, 폼 유효성 전체 검증

**단위 테스트 3종(payload-builder, timing-service, form-parser) 136개 전부 통과 — 스펙 §3.3 deep-equal, 오프셋 보정, 시간 가드, 폼 유효성 전체 검증**

## What Happened

T05 실행 시 세 테스트 파일이 이미 이전 태스크(T01~T04) 중에 작성되어 있었다.

- `src/shared/__tests__/payload-builder.test.ts` (284줄): parsePhone·normalizeBirthDate·buildApplyPayload 정상/에러 경로 테스트. 스펙 §3.3 예시 바디와 deep-equal 비교, phone 하이픈 제거, birthDate 슬래시→하이픈, 빈 rewards/consents 경계 케이스 포함.
- `src/main/services/__tests__/timing-service.test.ts` (312줄): parseServerDate RFC 7231 파싱, calculateFireTime 오프셋+RTT/2 보정·클램프, syncTime 가짜 fetch DI, isTimeGuardPassed 50ms 임계값, waitUntilFireTime 실시간 대기 검증.
- `src/shared/__tests__/form-parser.test.ts` (224줄): validateFormSchema 다중 에러 수집, isFormOpen 경계값·누락 formOpenAt, getSelectableRewards 필터링·다중 그룹 조합.

`npm test` 결과: 8개 테스트 파일, 136개 테스트 모두 통과 (기존 57개 → 136개로 증가).
`npm run build` 결과: renderer(Vite) + main(tsc) 빌드 모두 성공, 타입 오류 0.

## Verification

npm test — 8 test files, 136 tests passed (0 failed). npm run build — Vite renderer + tsc main 빌드 성공.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm test` | 0 | pass — 8 files, 136 tests | 961ms |
| 2 | `npm run build` | 0 | pass — renderer + main 빌드 성공 | 4000ms |

## Deviations

테스트 파일 3종 모두 이전 태스크에서 이미 작성되어 있어 신규 작성 없이 실행 검증만 수행함.

## Known Issues

none

## Files Created/Modified

- `src/shared/__tests__/payload-builder.test.ts`
- `src/main/services/__tests__/timing-service.test.ts`
- `src/shared/__tests__/form-parser.test.ts`
