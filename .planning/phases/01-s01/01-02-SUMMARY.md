---
phase: "01"
plan: "02"
---

# T02: AuthService 클래스(EventEmitter 기반) + IPC 핸들러 분리 + JWT 마스킹 유틸 구현 — 타입 체크·빌드·단위 테스트 통과

**AuthService 클래스(EventEmitter 기반) + IPC 핸들러 분리 + JWT 마스킹 유틸 구현 — 타입 체크·빌드·단위 테스트 통과**

## What Happened

기존 main.ts에 인라인으로 작성된 스텁 수준의 인증 로직을 AuthService 클래스로 완전히 분리하고, IPC 핸들러를 ipc-handlers.ts로 위임했다.

**AuthService (src/main/services/auth-service.ts)**

- EventEmitter 상속으로 login-success, login-failed, cookie-extraction-failed, token-expired, token-validated 이벤트 emit
- login(): BrowserWindow({ partition: 'persist:weverse' })로 쿠키 격리, 30초 하드 타임아웃, did-navigate 이벤트로 로그인 완료 감지
- extractToken(): .weverse.io와 weverse.io 두 도메인 변형 모두 시도, try/catch로 cookies.get() 실패 처리
- validateToken(): AbortController 5초 타임아웃, 401 → token-expired 이벤트 + cachedToken=null, JSON 파싱 실패 / fanId 누락 처리
- isTokenExpired(): JWT exp 클레임 파싱 (base64url decode), 파싱 실패 시 false 반환 (안전한 기본값)

**IPC 핸들러 (src/main/ipc-handlers.ts)**

- registerIpcHandlers()/unregisterIpcHandlers() 패턴으로 테스트 가능한 구조
- authService 'auth-event'를 renderer로 포워딩
- profile:save/load는 safeStorage 암호화 유지

**마스킹 유틸 (src/shared/mask.ts)**

- maskToken(): 앞 20자 + "..." + 뒤 20자 (≤40자이면 ***)
- maskPhone(): 마지막 4자리만 노출
- maskBirthDate(): 연도만 노출

**main.ts 리팩토링**

- 인라인 IPC/인증 로직 제거, registerIpcHandlers()와 setMainWindow() 위임

**단위 테스트 (src/shared/__tests__/mask.test.ts)**

- maskToken/maskPhone/maskBirthDate 경계 조건 + isTokenExpired 네거티브 케이스 17개 전체 통과

## Verification

1. tsc --noEmit (전체 tsconfig): exit 0
2. tsc -p tsconfig.main.json --noEmit: exit 0 (session import 제거 후)
3. npm run build (renderer + main): exit 0, vite 26 modules transformed
4. 단위 테스트 17개 node 실행: ✓ All tests passed

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `./node_modules/.bin/tsc --noEmit` | 0 | pass | 4200ms |
| 2 | `./node_modules/.bin/tsc -p tsconfig.main.json --noEmit` | 0 | pass | 3800ms |
| 3 | `npm run build` | 0 | pass | 8500ms |
| 4 | `node /tmp/mask-test/__tests__/mask.test.js` | 0 | pass — 17 tests all passed | 120ms |

## Deviations

main.ts에 이미 로그인/쿠키 추출 스텁이 인라인으로 구현되어 있었음. 태스크 플랜대로 auth-service.ts로 완전 분리하고 main.ts는 위임 구조로 재작성했다. preload.ts와 App.tsx는 이미 태스크 계획과 일치하는 상태여서 수정하지 않았다.

## Known Issues

Electron sandbox:true 환경에서 fetch()가 Node.js fetch를 사용하므로 실제 실행 시 Electron의 net 모듈 대신 Node fetch가 호출됨 — 운영에서는 electron.net.fetch로 교체를 고려할 수 있으나 타입/빌드 수준에서는 문제없음.

## Files Created/Modified

- `src/main/services/auth-service.ts`
- `src/main/ipc-handlers.ts`
- `src/shared/mask.ts`
- `src/main/main.ts`
- `src/shared/__tests__/mask.test.ts`
