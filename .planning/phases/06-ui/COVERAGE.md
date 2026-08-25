# API Coverage — Phase 06

No external API integration: 이 phase 는 로그인 *메커니즘* 위에 선택·고지·안내 계층만 얹고,
외부 API 표면은 새로 추가하지 않는다 — 오히려 반증된 계정 API 호출부(`requestOtpSession()`,
`loginWithCredentials()`, `verifyOtp()`)를 **삭제**한다.

## 판단 근거

| 항목 | 내용 |
|---|---|
| 신규 외부 엔드포인트 | 0개 — 이 phase 가 추가하는 HTTP 호출 없음 |
| 신규 SDK/패키지 | 0개 — `06-RESEARCH.md` § Standard Stack 이 "신규 런타임 의존성 없음"을 실측 확인 |
| 삭제되는 외부 호출 | `POST /v2/auth/otp-sessions`, `POST /v4/auth/token/by-credentials`, `POST /v3/auth/token/by-credentials-with-otp` (D-02 — 2026-08-25 HAR 실측으로 반증된 계약) |
| 유지되는 외부 호출 | `acquireFaneventToken()` 사다리 / `exchangeForService()` / `GET /fans/me` — **Phase 05 에서 이미 통합·검증된 표면**이며 이 phase 는 코드를 건드리지 않는다 (R019 자산) |
| 신규 IPC 채널 | `settings:get-login-mode` / `settings:set-login-mode` / `settings:get-notice-ack` / `settings:ack-notice` — 프로세스 내부 계약이지 외부 API 가 아니다 |

## 재통합 기준선 재판정 (동일 니즈에 대한 2차 통합 여부)

이 phase 는 "자격증명 로그인"이라는 동일 니즈에 대한 2차 통합이 **아니다.** D-01 이 확정한
API 모드 = 기존 `credentialLogin()` 헤드리스 경로이며, 새 클라이언트를 세우지 않고 **기존
경로 하나로 수렴**시킨다. 따라서 full-coverage 기준선을 새로 세울 대상 표면이 존재하지 않는다.

*Written at plan time by gsd-planner, 2026-08-26.*
