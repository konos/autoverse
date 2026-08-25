---
phase: "01"
plan: "04"
---

# T04: LoginPanel + ProfileForm UI 컴포넌트 구현 — 로그인 상태 표시, 프로필 입력/저장/로드 흐름 완성, 타입 체크·빌드 통과

**LoginPanel + ProfileForm UI 컴포넌트 구현 — 로그인 상태 표시, 프로필 입력/저장/로드 흐름 완성, 타입 체크·빌드 통과**

## What Happened

T04에서는 Renderer 프로세스의 UI를 3개 파일로 구성했다.

1. **LoginPanel.tsx**: 로그인 상태(미로그인/로그인중/로그인완료/만료)를 CSS 변수 기반 색상 배지로 표시. fanId, tokenPreview를 조건부 렌더링. 로그인 버튼은 로딩 중 또는 이미 로그인된 상태에서 비활성화. ARIA 속성(aria-busy, aria-live) 포함.

2. **ProfileForm.tsx**: 마운트 시 `window.api.profile.get()`으로 저장된 프로필을 불러와 폼을 자동 채움(실패 시 빈 폼으로 폴백). birthDate(YYYY-MM-DD), phoneCountryCode, phoneNumber 필드 포함. 인라인 검증(빈값, 날짜 형식, 전화번호 자리수) 후 `window.api.profile.save()`로 저장. 저장 성공 시 success 메시지, 실패 시 error 메시지 표시.

3. **App.tsx 수정**: `step: "login" | "profile"` 상태로 흐름 관리. 초기화 시 `auth:status` IPC로 현재 상태 확인 후 이미 로그인된 경우 바로 profile 단계로 진입. `onAuthEvent`에서 login-success/token-validated → profile step, login-failed/token-expired/cookie-extraction-failed → login step + loginError 메시지 표시. `LoginPanel`은 항상 렌더링되어 현재 상태를 보여주고, ProfileForm은 로그인 완료 + fanId 존재 시에만 렌더링.

4. **styles.css**: CSS 변수 기반 디자인 토큰(--color-primary, --color-error, --color-success 등). card, form-field, btn, status-badge, token-preview, error-message, success-message 클래스 정의. 별도 UI 라이브러리 없이 순수 CSS.

5. **profile-form-validation.test.ts**: 폼 검증 로직의 단위 테스트 12개 — 유효 입력, 빈 값, 잘못된 날짜 형식, 전화번호 길이 경계, 대시 포함 전화번호 등.

**실패 모드 처리:**

- openLogin 예외 → catch → loginError 상태
- token-expired IPC → loginError + step="login" 복귀
- cookie-extraction-failed IPC → loginError + step="login" 복귀  
- profile.get() 실패 → 빈 폼 폴백 (`.catch(() => {})`)
- profile.save() 실패 → 인라인 error 메시지

## Verification

1. `node_modules/.bin/tsc --noEmit` → 타입 에러 없음 (exit 0)
2. `npm run build` → vite renderer 빌드 + tsc main 빌드 모두 성공 (exit 0)
3. profile-form-validation.test.ts 12개 테스트 → 12 passed, 0 failed (esbuild + node)

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `node_modules/.bin/tsc --noEmit` | 0 | pass | 3200ms |
| 2 | `npm run build` | 0 | pass | 1100ms |
| 3 | `node_modules/.bin/esbuild src/renderer/components/__tests__/profile-form-validation.test.ts --bundle=false --platform=node | node` | 0 | pass — 12/12 tests passed | 350ms |

## Deviations

none — 계획대로 4개 파일(LoginPanel, ProfileForm, App.tsx, styles.css) 구현 완료. 추가로 검증 로직 단위 테스트 파일 생성.

## Known Issues

Electron 앱 실제 실행(수동 E2E) 미수행 — node_modules에 electron 바이너리가 없어 `npm start` 실행 불가. 타입 체크·빌드 통과로 정적 검증 완료.

## Files Created/Modified

- `src/renderer/components/LoginPanel.tsx`
- `src/renderer/components/ProfileForm.tsx`
- `src/renderer/App.tsx`
- `src/renderer/styles.css`
- `src/renderer/components/__tests__/profile-form-validation.test.ts`
