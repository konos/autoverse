# Autoverse

## What This Is

Weverse 팬이벤트 선착순(FIFO) 신청을 자동화하는 Electron 데스크탑 앱. 본인 단일 계정으로 서버 시간 동기화 후 정시에 POST가 도착하도록 정밀 타이밍 신청을 수행한다. 특정 소수 고객(팬)에게 제공하며 Windows/macOS 크로스플랫폼으로 배포한다. **M001-ksbtje MVP 완성 — 2026-05-13.**

## Core Value

서버 시간 보정 + RTT 반영으로 선착순 이벤트 신청 POST가 정시에 서버에 도착하는 것. 이것이 수동 신청 대비 핵심 차별점이다.

## Project Shape

- **Complexity:** complex
- **Why:** Electron 크로스플랫폼 빌드, 웹 세션 쿠키 추출, 서버 시간 동기화 + RTT 보정, 암호화 프로필 저장, 동적 applyHost 대응 등 여러 기술 영역이 교차한다.

## Current State

**M001-ksbtje 완료 (2026-05-13), 이후 v0.2.0에서 로그인을 헤드리스 방식으로 전환.** 4개 슬라이스 전부 complete, 163개 단위 테스트 통과, tsc 오류 0, macOS .dmg 95MB + Windows .exe 84MB 아티팩트 생성 완료.

**현재 v0.3.0 진행 중** — 클라이언트 요청으로 로그인 방식(API 통신 / 브라우저) 선택 기능 추가.

## Current Milestone: v0.3.0 로그인 방식 선택 (API / 브라우저)

**Goal:** 사용자가 로그인 방식을 API 통신과 브라우저 중 선택할 수 있게 하고, 각 방식의 제약을 앱이 명확히 안내한다.

**Target features:**
- API 로그인 경로 신규 구현 — `otp-sessions` → `by-credentials` → `by-credentials-with-otp` 3단계
- 이메일 OTP 입력 흐름 — API 모드는 매 로그인마다 OTP 필수
- 토큰 교환 — account 토큰(`wa_access_token`) → 팬이벤트용 `we2_access_token`
- 방식 선택 UI — 브라우저 모드 기본값, API는 선택 옵션
- 토큰 만료 사전 경고 — 신청 시각 전 토큰 수명 체크 후 재로그인 유도

**검증된 API 계약 (2026-08-25 실측):**

| 항목 | 값 |
|---|---|
| Base URL | `https://accountapi.weverse.io/web/api` |
| 세션 생성 | `POST /v2/auth/otp-sessions` — body `{email}` |
| 로그인 | `POST /v4/auth/token/by-credentials` — body `{email, password, otpSessionId}` |
| OTP 로그인 | `POST /v3/auth/token/by-credentials-with-otp` — `+{otpCode, refreshTokenCookieTtl}` |
| 필수 헤더 | `X-ACC-APP-VERSION: 4.7.1`, `X-ACC-APP-SECRET`, `X-ACC-SERVICE-ID: weverse`, `X-ACC-LANGUAGE`, `X-ACC-TRACE-ID` |
| 비밀번호 | 평문 전송 (TLS 위) — 클라이언트 측 RSA/암호화 없음 |
| reCAPTCHA | v3 invisible, **OTP 세션 생성 시에만** 사용 |

**핵심 제약 (실측 확인):** 캡차 토큰 없이 순수 HTTP로 로그인하면 서버가 `-25044 이메일 OTP 인증이 필요합니다`로 응답한다. 즉 **API 모드는 매 로그인마다 OTP 입력이 강제**되며, 이 때문에 API 모드에서는 자동 재로그인이 불가능하다. 브라우저 모드가 기본값인 이유.

## Architecture / Key Patterns

- **스택:** Electron + TypeScript + React (Vite 빌드)
- **인증:** Electron BrowserWindow(v0.2.0부터 `show: false` 헤드리스)로 weverse.io 로그인 → `session.cookies.get()`으로 `we2_access_token` 추출. `.weverse.io` / `weverse.io` 두 도메인 변형 모두 시도. 쿠키는 `persist:weverse` 파티션에 격리.
- **프로필 저장:** Electron `safeStorage` API로 OS 수준 암호화 후 앱 데이터 폴더에 저장. 복호화 실패 시 손상 파일 자동 삭제.
- **HTTP:** Node.js 내장 fetch. ApplyEngine은 WeverseApi + TimingService를 생성자 DI로 주입받음.
- **시간 동기화:** 서버 `Date` 헤더 파싱 → 오프셋 계산 → RTT/2 보정(localMidMs = t0 + rttMs/2) → `startAt` 정시 도착
- **안전 가드:** postFired 플래그(POST 1회 보장) + isTimeGuardPassed()(startAt-50ms 차단) 이중 가드
- **로그:** LogService(EventEmitter 싱글톤) + maskSensitive 7종 마스킹 + LogPanel 실시간 UI + logs/YYYY-MM-DD.log 일별 파일
- **IPC:** auth:*, profile:*, apply:*, log:* 4개 네임스페이스로 main↔renderer 분리
- **빌드:** `electron-builder`로 macOS .dmg(arm64, 95MB) + Windows NSIS .exe(arm64, 84MB)

## Capability Contract

See `.planning/REQUIREMENTS.md` for the explicit capability contract, requirement status, and coverage mapping.

## Milestone Sequence

- [x] M001-ksbtje: Weverse 팬이벤트 선착순 신청 자동화 앱 — 로그인, 신청 엔진, 로그 시스템, 크로스플랫폼 빌드까지 전체 MVP — **완료 2026-05-13**
- [ ] v0.3.0: 로그인 방식 선택 (API 통신 / 브라우저) — **진행 중**

## Out of Scope

- **다계정 동시 신청** — 별도 마일스톤(v0.4.0 후보)으로 분리. 저장소·세션·엔진 전반의 다중화가 필요해 스코프가 독립적이며, 같은 IP에서 동시 신청 시 플랫폼 제재 리스크를 클라이언트가 먼저 확인해야 한다.
- **reCAPTCHA 우회** — 계정 정지 및 법적 리스크. 영구 제외. API 모드의 OTP 강제는 우회 대상이 아니라 명시적으로 안내할 제약으로 다룬다.
- **API 모드 자동 재로그인** — OTP가 사람의 개입을 요구하므로 기술적으로 불가능. 사전 경고로 대체한다.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 브라우저 모드를 기본값으로 유지 | API 모드는 매 로그인 OTP가 강제되어 선착순 자동화의 핵심 가치를 훼손한다 | — Pending |
| API 모드 토큰 만료는 사전 경고로 대응 | 자동 재로그인이 불가능하므로, 이벤트를 놓치기 전에 사용자가 개입할 시간을 준다 | — Pending |
| 로그인 API를 리버싱해 직접 호출 | 번들 분석 + 실서버 프로브로 계약을 검증함 (2026-08-25) | ✓ Good |

## Known Limitations (Post-M001)

- 코드 서명 미적용 — macOS Gatekeeper / Windows SmartScreen 경고 발생. 퍼블릭 배포 시 Apple Developer ID 공증 + Microsoft Authenticode 인증서 필요.
- arm64 단일 아키텍처 — x64 사용자를 위한 universal binary / x64 exe 미지원.
- 자동 업데이트 미구현 — 신버전 시 수동 재설치 필요.
- 로그 파일 로테이션 미구현 — 장기 운영 시 디스크 사용량 증가 가능성.
- Electron 런타임 종단 E2E 미수행 — 실제 이벤트 환경에서의 검증 예정.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-25 after v0.3.0 milestone start*
