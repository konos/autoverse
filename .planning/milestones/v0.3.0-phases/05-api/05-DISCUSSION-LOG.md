# Phase 05: API 로그인 핵심 흐름 + 토큰 교환 검증 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-25
**Phase:** 05-api
**Areas discussed:** 기존 플랜 처리, R019 검증 경로, R017/R018 요구사항 운명, 실계정 프로브 안전장치, 05-01 잔존 자산 처리

**배경:** 사용자가 논의 시작과 동시에 방향을 지시했다 — *"헤드리스 브라우저로 account 토큰
얻어서 R019 사다리부터 검증하자."* 이후 질문은 그 방향을 구체화하는 데 집중했다.

**논의 중 발견된 사실 (질문 설계를 바꿈):** 현재 `extractTokenFromCookies()`
(`src/main/services/auth-service.ts:678`)는 `we2_access_token` 쿠키 하나만 읽는다. 즉 헤드리스
로그인은 이미 팬이벤트 토큰을 바로 내주고 account 토큰은 어디에도 보관되지 않는다. 이 사실을
먼저 제시한 뒤 "토큰 확보 방법"과 "사다리가 무엇을 증명해야 하는가"를 질문으로 분리했다.

---

## 기존 플랜 처리

| Option | Description | Selected |
|--------|-------------|----------|
| 논의 후 재플랜 | CONTEXT.md를 새로 쓰고 `/gsd-plan-phase 5`로 05-01/05-02 재작성 | ✓ |
| 기존 플랜 먼저 보기 | 05-01-PLAN.md / 05-02-PLAN.md 확인 후 결정 | |
| 취소 | 논의 중단 | |

**User's choice:** 논의 후 재플랜
**Notes:** 05-01은 halted(2/3 tasks), 05-02는 blocked. 05-02의 "OTP 재발송·만료 처리"
태스크는 대상 세션이 실재하지 않아 전체가 무효.

---

## R019 검증 경로 — account 토큰 확보

| Option | Description | Selected |
|--------|-------------|----------|
| 쿠키 파티션에서 추가로 읽기 | `persist:weverse`에서 account 토큰 쿠키 조회. 변경 최소지만 쿠키 이름/존재 미확인 — 없을 수도 있음 | |
| by-credentials 응답 가로채기 | `webRequest`/`webContents`로 200 응답의 `accessToken` 캡처. HAR로 존재 확인됨 | |
| 쿠키 우선 + 응답 캡처 폴백 | 쿠키 먼저, 없으면 응답 캡처. 스파이크 1회로 두 질문 동시 해소 | ✓ |

**User's choice:** 쿠키 우선 + 응답 캡처 폴백
**Notes:** 쿠키 단독 의존은 미확인 가정 위에 서고, 응답에 `accessToken`(427자)이 있다는 것은
HAR로 확정된 사실이라 폴백이 확실하다.

---

## R019 검증 경로 — 사다리 검증 범위

| Option | Description | Selected |
|--------|-------------|----------|
| rung1 + rung2 전체 | account 토큰 단독 `/fans/me` 직접 호출 → 실패 시 `by-access-token` 교환 후 재시도 | ✓ |
| rung2(교환)만 | direct는 쿠키로 이미 되니 교환 가능 여부만 확인 | |
| 전체 + 쿠키 토큰과 대조 | 사다리 결과를 기존 `we2_access_token` 쿠키 값과 비교까지 | |

**User's choice:** rung1 + rung2 전체
**Notes:** 브라우저 경로가 이미 `we2_access_token`을 내주지만, 사다리 검증의 가치는 미래에
순수 HTTP 로그인 경로가 열릴 때를 대비한 것. `acquireFaneventToken()` 구조가 이미 이 형태라
로직 재작성이 아니라 입력 공급만 필요하다.

---

## R019 검증 경로 — 작업 성격

| Option | Description | Selected |
|--------|-------------|----------|
| 스파이크 먼저, 결과 보고 결정 | 검증만 하고 코드는 최소. 결과 문서화 후 API 모드 최종 정의는 그 다음 | ✓ |
| 제품 경로로 확정 | "API 모드 = 헤드리스로 account 토큰 확보 + 이후 순수 HTTP"로 지금 재정의하고 구현 | |
| 순수 스파이크로 종결 | 검증 결과만 남기고 Phase 05를 닫음. API 모드 구현은 별도 phase | |

**User's choice:** 스파이크 먼저, 결과 보고 결정
**Notes:** 마일스톤 최대 리스크(R019)를 조기에 걷어내는 것이 원래 Phase 05의 의도. 사다리가
실패하면 API 모드 정의가 또 바뀌므로 그 위에 제품 코드를 쌓지 않는다.

---

## R017/R018 요구사항 운명

| Option | Description | Selected |
|--------|-------------|----------|
| R018 보류, R017 재기술 | R018을 blocked/unverified로 내리고 사유 명시, R017의 "3단계 로그인" 서술을 실측 계약으로 교체 | ✓ |
| R018 완전 폐기 | Out of Scope로 이동. HAR 호출 0건 + OTP 메일 미수신 | |
| 스파이크 결과 후 정리 | 지금은 건드리지 않고 "재검토 필요"만 기록 | |

**User's choice:** R018 보류, R017 재기술
**Notes:** "OTP 경로가 없다"는 것을 증명한 것은 아니므로 완전 폐기에는 비약이 있다는 점을
제시했고, 사용자가 보류를 선택. 문서가 반증된 계약을 "검증됨"으로 주장하는 상태를 먼저 끝내는
것이 우선이라는 판단.

---

## 실계정 프로브 안전장치

*(multiSelect — 사용자가 1개만 선택)*

| Option | Description | Selected |
|--------|-------------|----------|
| 더미 이메일 체크리스트 명시 | 실서버 프로브 태스크는 착수 전 "사용할 이메일이 사용자 식별자와 무관한 더미인가" 확인 | |
| 스파이크 전 credentials.enc 선삭제 | 저장된 자격증명의 예기치 않은 재사용 경로 물리 차단 | |
| 실계정 로그인은 사용자가 수행 | Claude는 배선·분석만, 자격증명 입력/실행은 사용자 | ✓ |
| 프로브 1회 제한 · 재시도 금지 | 단일 계정·1회로 제한, 실패해도 자동 재시도 없음 | |

**User's choice:** 실계정 로그인은 사용자가 수행
**Notes:** 05-01에서 발생한 두 건의 실사용 피해(다른 계정 헤드리스 로그인 시도 → 알림 메일
발송, 실행자가 사용자 실제 이메일로 외부 API 호출)를 배경으로 제시했다.

선택되지 않은 두 항목(`credentials.enc` 선삭제, 1회 제한)은 플랜에 강제하지 않는다.

**단, "더미 이메일" 항목은 Claude 자신의 행동 기준이므로 사용자 선택과 무관하게 기본값으로
유지한다는 점을 논의 중 명시했다** — 05-01에서 실제로 어긴 항목이기 때문. CONTEXT.md D-06에
"비협상 기준선"으로 기록됨.

---

## 05-01 잔존 자산 처리

| Option | Description | Selected |
|--------|-------------|----------|
| 스파이크 동안 그대로 두기 | 사다리 결과 확정 후 일괄 정리. 폴백 경로 재확인 시 재사용 가능 | ✓ |
| 지금 삭제 | HTTP 셸 + `acquireFaneventToken()`만 유지, 무효 메서드/테스트 제거 | |
| 무효 표시만 붙이기 | `@deprecated` + "HAR로 반증됨, 05-01-SUMMARY 참조" 주석 | |

**User's choice:** 스파이크 동안 그대로 두기
**Notes:** 대상 메서드는 `requestOtpSession`, `loginWithCredentials`, `submitOtpApi`.
지금 지우면 캡차 실패 폴백 경로를 재확인할 때 다시 써야 하므로 D-04(스파이크 우선)와 일관.

---

## 마무리 확인

| Option | Description | Selected |
|--------|-------------|----------|
| CONTEXT.md 작성 | 지금 결정으로 충분 | ✓ |
| 사다리 실패 시 분기 논의 | rung1·rung2 모두 실패할 때의 허용 경로를 미리 정함 | |
| 스파이크 산출물 형식 논의 | 문서만 / 회귀 테스트까지 / 제품 코드로 유지 | |
| Phase 06/07 영향 논의 | R018 보류가 Phase 06 성공기준 2와 Phase 07 전제에 미치는 영향 | |

**User's choice:** CONTEXT.md 작성
**Notes:** 선택되지 않은 세 영역은 CONTEXT.md의 Deferred Ideas에 보존됨.

---

## Claude's Discretion

- 사다리 검증 결과를 어떤 형태로 남길지(문서 / 회귀 테스트 / 제품 코드) — 사용자가 별도
  논의를 선택하지 않아 planner 재량. 단 D-04(최소 코드) 범위 내.
- account 토큰 쿠키의 실제 이름 탐색 방법, `webRequest` 훅의 구체적 배선 지점.

## Deferred Ideas

- 사다리 실패 시 분기 결정 (마일스톤 축소 / API 모드 폐기 / 재조사)
- 스파이크 산출물 형식
- Phase 06/07 영향 정리 — R018 보류가 Phase 06 성공기준 2, Phase 07 자격증명 저장 전제를 바꿈
- API 모드 제품 경로 확정 — 사다리 결과 확인 후
- `ApiAuthClient` 무효 메서드 정리 — 스파이크 종료 후
- 로그아웃 UI 갭 — `credentials.enc`를 앱에서 지울 수 없음 (Phase 07 후보)
