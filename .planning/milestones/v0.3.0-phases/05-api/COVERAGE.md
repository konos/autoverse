# API Coverage — Weverse Account API (`accountapi.weverse.io`) + Fanevent API (`fanevent-v2.weverse.io`)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
>
> **Phase 05 컨텍스트:** 이 phase는 제품 구현이 아니라 **R019 사다리 검증 스파이크**다 (CONTEXT.md D-04).
> 따라서 대부분의 capability가 OPT-OUT이며, 사유는 "스파이크 범위 밖"이 아니라 각각 구체적으로 기록한다.
> 스파이크 결과로 API 모드 제품 경로가 확정되면 이 매트릭스를 같은 full-coverage 기준선에서 **다시** 결정한다
> (이전 opt-out을 조용히 승계하지 않는다).

## Account API (`https://accountapi.weverse.io/web/api`)

| capability | decision | reason |
|---|---|---|
| `POST /v2/auth/token/by-access-token` (account → fanevent 토큰 교환) | INTEGRATE | R019 사다리 rung2. 이 phase의 핵심 검증 대상 |
| `GET /v2/auth/token` (프로필/토큰 조회) | OPT-OUT | HAR상 실제 흐름에 존재하나 신청 자동화에 필요한 정보가 없음. 필요해지면 Phase 07(토큰 수명 경고)에서 재검토 |
| `POST /v4/auth/token/by-credentials` (자격증명 로그인) | OPT-OUT | 순수 HTTP 호출은 reCAPTCHA Enterprise 토큰을 요구하며, 토큰의 프로그램적 생성·주입은 R013으로 영구 제외. 이 phase는 헤드리스 BrowserWindow의 실제 로그인 페이지가 이 호출을 수행하게 하고 그 **응답만 관찰**한다 (D-02) — 직접 호출하지 않는다 |
| `POST /v2/auth/otp-sessions` (OTP 세션 생성) | OPT-OUT | HAR 실측 결과 실제 로그인 흐름에 존재하지 않음(호출 0건). R018 보류에 따라 이 마일스톤에서 제외 (D-05) |
| `POST /v3/auth/token/by-credentials-with-otp` (OTP 로그인) | OPT-OUT | 위와 동일 — 실제 웹 클라이언트가 사용하지 않는 경로. R018 보류 (D-05) |
| `POST /v2/auth/otp` (OTP 코드 발송) | OPT-OUT | 위와 동일. 05-01 실계정 스파이크에서 OTP 메일 미수신으로 경로 자체가 미입증 |
| 토큰 갱신 (refresh) | OPT-OUT | 갱신 엔드포인트가 캡처되지 않음. R015로 이미 Out of Scope 확정 — 재로그인 안내(R022)로 대체 |
| reCAPTCHA 토큰 획득/주입 | OPT-OUT | **영구 제외.** R013 anti-feature, PROJECT.md Out of Scope. 약관 위반 및 계정 정지 리스크 |

## Fanevent API (`https://fanevent-v2.weverse.io/api/fan-api`)

| capability | decision | reason |
|---|---|---|
| `GET /v1/fans/me` (토큰 유효성 + fanId) | INTEGRATE | R019 사다리 rung1/rung2의 판정 신호. 이미 `api-auth-client.ts`에 구현됨 |
| 이벤트 폼 스키마 조회 | INTEGRATE | M001/R002에서 이미 구현·검증 완료 (`weverse-api.ts`). 이 phase는 변경하지 않음 |
| 신청 POST (선착순 제출) | INTEGRATE | M001/R003에서 이미 구현·검증 완료. 이 phase의 Success Criteria 3은 이것이 **무변경으로** 동작함을 요구 |
| 신청 결과 폴링 (REQUESTED → COMPLETED) | INTEGRATE | M001/R004에서 이미 구현·검증 완료 |
| 추첨형(DRAW) 이벤트 | OPT-OUT | 선착순(FIFO) 전용 프로젝트. R011로 Out of Scope 확정 |
| 다계정 동시 신청 | OPT-OUT | R012 anti-feature — 약관 위반 및 형평성 문제. v0.4.0 요청 시 명시적 재검토 필요 |
