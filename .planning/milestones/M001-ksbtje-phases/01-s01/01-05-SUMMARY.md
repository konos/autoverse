---
phase: "01"
plan: "05"
---

# T05: Vitest 설정 + 마스킹 유틸리티·ProfileStore·AuthService JWT 파싱 단위 테스트 57개 작성 — 전체 통과, 타입 체크 무결

**Vitest 설정 + 마스킹 유틸리티·ProfileStore·AuthService JWT 파싱 단위 테스트 57개 작성 — 전체 통과, 타입 체크 무결**

## What Happened

## 수행 내용

**1. Vitest 설치 및 설정**

- `vitest@4.1.6`, `@vitest/coverage-v8@4.1.6` devDependency 설치
- `vitest.config.ts` 생성: node 환경, `src/**/__tests__/**/*.test.ts` 포함, v8 커버리지 설정

**2. mask.test.ts — Vitest 형식으로 완전 재작성**

- 기존 ts-node 방식의 inline assert 패턴을 Vitest describe/it/expect로 전환
- `maskToken`: 빈 문자열·짧은 토큰(≤40자)·긴 토큰 앞20+...+뒤20 형식 검증
- `maskPhone`: 빈/너무 짧은/정상 입력 케이스
- `maskBirthDate`: 빈/정상 날짜 케이스
- `isTokenExpired` (inline 재구현): 만료·유효·no-exp·malformed 7개 케이스 — exp 경계값(현재 시각 -1초) 포함

**3. auth-service.test.ts — 신규 작성**

- `vi.mock("electron", ...)` 으로 BrowserWindow/safeStorage/app 목킹
- `AuthService.isTokenExpired()`: 14개 케이스
  - Positive: future exp, past exp, 경계(1초 전, 1시간 전, 1년 후)
  - Negative: no exp, exp가 string/null type
  - Malformed: 평문 문자열, 2-part, 빈 문자열, invalid base64, non-JSON base64, 4-part
- `AuthService.getStatus()`: 토큰 없을 때 isLoggedIn:false, 토큰 있을 때 tokenPreview 마스킹 형식 검증

**4. profile-store.test.ts — Vitest 형식으로 완전 재작성**

- 기존 TestableProfileStore inline 재구현 방식을 vi.mock + 실제 ProfileStore 클래스 테스트로 전환
- `vi.hoisted()` 패턴 적용 — vi.mock 호이스팅과 변수 선언 순서 충돌 해결
- 실제 tmp 디렉토리 + 가짜 encrypt/decrypt mock으로 파일시스템 라운드트립 테스트
- 테스트 케이스: round-trip, no-file null, clearProfile, safeStorage 불가(저장거부/읽기거부), decrypt 실패+파일삭제, JSON 파싱 실패+파일삭제, 반복 저장 덮어쓰기, minimal profile

**5. profile-form-validation.test.ts — Vitest 형식으로 재작성**

- 기존 ts-node 방식(console.log + process.exit)을 Vitest describe/it/expect로 전환
- birthDate/phoneNumber 유효성 검사 12개 케이스

**6. package.json 스크립트 추가**

- `"test": "vitest run"`
- `"test:watch": "vitest"`
- `"test:coverage": "vitest run --coverage"`

## 이슈 해결

- `vi.mock` factory 내에서 최상위 변수 참조 불가 (호이스팅 문제) → `vi.hoisted()` 패턴으로 해결
- 기존 `profile-form-validation.test.ts`가 ts-node 방식이라 Vitest가 test suite를 찾지 못하는 오류 → Vitest 형식으로 재작성

## Verification

1. `npm test` 실행 → 4 파일 / 57 테스트 전부 통과 (exit 0)
2. `npx tsc --noEmit` 실행 → 타입 오류 없음 (exit 0)
3. 각 파일별 테스트 수: mask.test.ts(18), auth-service.test.ts(16), profile-store.test.ts(11), profile-form-validation.test.ts(12) = 합계 57

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm test` | 0 | pass — 4 test files, 57 tests passed | 214ms |
| 2 | `npx tsc --noEmit` | 0 | pass — no type errors | 8000ms |

## Deviations

profile-form-validation.test.ts는 T05 태스크 계획에 명시되지 않았으나, 기존 ts-node 방식 파일이 Vitest 실행 시 오류를 일으켜 함께 재작성함 (범위 확대, 파괴적 변경 없음)

## Known Issues

AuthService.login(), extractToken(), validateToken()은 Electron BrowserWindow/session/cookies API에 강하게 결합되어 있어 단위 테스트 범위에서 제외. 향후 E2E 혹은 Electron 통합 테스트에서 커버 필요.

## Files Created/Modified

- `vitest.config.ts`
- `src/shared/__tests__/mask.test.ts`
- `src/main/services/__tests__/auth-service.test.ts`
- `src/main/services/__tests__/profile-store.test.ts`
- `src/renderer/components/__tests__/profile-form-validation.test.ts`
- `package.json`
