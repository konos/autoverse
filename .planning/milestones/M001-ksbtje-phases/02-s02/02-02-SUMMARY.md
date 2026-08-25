---
phase: "02"
plan: "02"
---

# T02: TimingService 구현 — 서버 Date 헤더 오프셋 계산 + RTT/2 보정 + 정밀 발사 타이밍 + 시간 가드, 21개 단위 테스트 포함

**TimingService 구현 — 서버 Date 헤더 오프셋 계산 + RTT/2 보정 + 정밀 발사 타이밍 + 시간 가드, 21개 단위 테스트 포함**

## What Happened

스펙 §6 서버 시간 동기화 전략을 `src/main/services/timing-service.ts`에 구현했다.

**구현 내용:**

- `syncTime(token)`: GET /fans/me 호출 전후 로컬 타임스탬프로 RTT 계산, 응답 Date 헤더로 서버 시간 추출, `offsetMs = serverNowMs - localMidMs` 계산. Date 헤더 누락·파싱 실패 시 `offsetMs=0` 폴백 (crash 없음), 5초 AbortController 타임아웃.
- `calculateFireTime(startAt, syncResult)`: `startAt - offsetMs - rttMs/2` 계산. 결과가 `startAt - 50ms` 이전이면 클램프.
- `waitUntilFireTime(fireTimeMs)`: 잔여 > 50ms → setTimeout, ≤ 50ms → busy-wait (while + Date.now()) 정밀 대기.
- `parseServerDate(dateHeader)`: RFC 7231 HTTP-date 파싱, 실패 시 Error throw.
- `isTimeGuardPassed(startAt, syncResult)`: 보정된 서버 시간이 `startAt - 50ms` 이후인지 확인, false면 POST 차단.
- 모든 로그에 ISO 타임스탬프, 토큰은 `maskToken()` 마스킹 적용.

**타입 추가:** `TimeSyncResult` 인터페이스를 `src/shared/types.ts`에 추가.

**테스트:** `src/main/services/__tests__/timing-service.test.ts` 21개 단위 테스트 작성 — parseServerDate(유효/무효), calculateFireTime(오프셋·클램프·음수·zero RTT), syncTime(Date 헤더 없음·파싱 실패·RTT 측정·Bearer 헤더 확인), isTimeGuardPassed(경계값·오프셋 보정), waitUntilFireTime(과거·근미래·>50ms) 커버.

**편차:** import 경로를 `@shared/*` 별칭 대신 상대 경로(`../../shared/*`)로 작성 — Vitest config에 alias 미설정이므로 기존 서비스 관례(auth-service.ts 동일 패턴) 준수.

## Verification

1. `npx tsc -p tsconfig.main.json --noEmit` — 타입 오류 없음 (exit 0)
2. `npx vitest run src/main/services/__tests__/timing-service.test.ts` — 21개 테스트 전원 통과
3. `npx vitest run` — 전체 스위트 120개 테스트 통과 (기존 99개 + 신규 21개)

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc -p tsconfig.main.json --noEmit` | 0 | pass | 4200ms |
| 2 | `npx vitest run src/main/services/__tests__/timing-service.test.ts` | 0 | pass — 21/21 tests | 237ms |
| 3 | `npx vitest run` | 0 | pass — 120/120 tests (7 files) | 314ms |

## Deviations

import 경로를 @shared/* alias 대신 상대 경로(../../shared/*)로 작성. Vitest config에 resolve.alias가 없어 테스트 실행 시 모듈 해석 실패가 발생하므로, auth-service.ts 등 기존 서비스와 동일한 관례 적용.

## Known Issues

None.

## Files Created/Modified

- `src/main/services/timing-service.ts`
- `src/main/services/__tests__/timing-service.test.ts`
- `src/shared/types.ts`
