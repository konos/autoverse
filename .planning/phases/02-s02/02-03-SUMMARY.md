---
phase: "02"
plan: "03"
---

# T03: ApplyEngine 오케스트레이터 + 안전 가드 + IPC 배선 구현 — POST 1회 보장, 시간 가드, consentIds 명시적 전달, apply:* IPC 5채널, 16개 단위 테스트

**ApplyEngine 오케스트레이터 + 안전 가드 + IPC 배선 구현 — POST 1회 보장, 시간 가드, consentIds 명시적 전달, apply:* IPC 5채널, 16개 단위 테스트**

## What Happened

T01(WeverseApi + 페이로드 빌더)과 T02(TimingService)를 조합하는 ApplyEngine EventEmitter 클래스를 `src/main/services/apply-engine.ts`에 구현했다.

**ApplyEngine 상태 머신:** idle → fetching-form → form-ready → armed → syncing-time → waiting → firing → polling → completed / error. 각 전환마다 phaseTimestamps에 epoch ms 기록.

**안전 가드 3종:**

1. `postFired` boolean 플래그 — execute() 진입 시 이미 true이면 즉시 POST_ALREADY_FIRED 에러로 차단
2. 시간 가드 — `TimingService.isTimeGuardPassed()` false 반환 시 TIME_GUARD_BLOCKED 에러
3. consentIds 명시 전달 — arm()에서 사용자가 전달한 값과 schema.consents ID 집합이 완전 일치해야 통과, 자동 채움 없음

**폴링 루프:** 300ms 간격 최대 15초. COMPLETED → 성공 반환. REQUESTED 외 상태(REJECTED/FAILED/DUPLICATED/EXPIRED) → APPLY_REJECTED 에러. 타임아웃 → POLL_TIMEOUT 에러.

**IPC 배선:**

- `ipc-handlers.ts`: apply:fetch-form, apply:arm, apply:execute, apply:state, apply:reset 핸들러 5개 추가. applyEngine.on('apply-event') → mainWindow.webContents.send('apply:event') 브로드캐스트. registerIpcHandlers/unregisterIpcHandlers 패턴은 S01과 동일.
- `preload.ts`: apply 네임스페이스 + onApplyEvent 구독 추가.

**types.ts 확장:** ApplyPhase, ApplyEngineState, ApplyResult 타입 추가. ApplyEventType에 'armed', 'completed' 이벤트 추가. IpcApi에 apply 네임스페이스 + onApplyEvent 추가.

**단위 테스트:** `apply-engine.test.ts` 16개 테스트 작성. WeverseApi/Electron/authService/profileStore를 vi.mock으로 격리(weverse-api의 @shared/mask 별칭은 Vitest config 미설정이므로 모킹 필요). fetchForm, arm, execute 안전 가드, 폴링, getState/reset, 이벤트 emit 전체 커버리지.

## Verification

1. `npx tsc -p tsconfig.main.json --noEmit` — 오류 없음
2. `npx tsc --noEmit` — renderer+shared 오류 없음
3. `npm run build` — renderer(vite) + main(tsc) 빌드 성공
4. `npm test` — 8개 테스트 파일, 136개 테스트 전부 통과 (기존 120 + 신규 16)

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc -p tsconfig.main.json --noEmit` | 0 | pass | 5200ms |
| 2 | `npx tsc --noEmit` | 0 | pass | 4800ms |
| 3 | `npm run build` | 0 | pass | 6100ms |
| 4 | `npm test` | 0 | pass — 136/136 tests passed (8 files) | 878ms |

## Deviations

없음 — 플랜 6단계 전부 구현 완료. waiting-consent 페이즈는 types.ts에 ApplyPhase 유니언으로 포함되어 있으나 현재 arm() 흐름에서는 form-ready → armed로 직접 전환(UI가 S03에서 구현되므로 엔진 레벨에서는 별도 waiting-consent 진입이 불필요).

## Known Issues

없음

## Files Created/Modified

- `src/main/services/apply-engine.ts`
- `src/shared/types.ts`
- `src/main/ipc-handlers.ts`
- `src/main/preload.ts`
- `src/main/services/__tests__/apply-engine.test.ts`
