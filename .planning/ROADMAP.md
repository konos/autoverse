# Roadmap: Autoverse

## Milestones

- ✅ **M001-ksbtje** - Phases 01-04 (shipped 2026-05-13)
- 🚧 **v0.3.0 로그인 방식 선택 (API / 브라우저)** - Phases 05-07 (in progress)

## Phases

<details>
<summary>✅ M001-ksbtje (Phases 01-04) - SHIPPED 2026-05-13</summary>

- [x] **Phase 01: s01** — S01
- [x] **Phase 02: s02** — S02
- [x] **Phase 03: s03** — S03
- [x] **Phase 04: s04** — S04

</details>

### 🚧 v0.3.0 로그인 방식 선택 (API / 브라우저) (In Progress)

**Milestone Goal:** 사용자가 로그인 방식을 API 통신과 브라우저 중 선택할 수 있게 하고, 각 방식의 제약을 앱이 명확히 안내한다.

- [ ] **Phase 05: API 로그인 핵심 흐름 + 토큰 교환 검증** - 이미 동작하는 헤드리스 로그인에서 계정 토큰을 확보해 account→팬이벤트 토큰 사다리(R019)가 실계정에서 성립하는지 판정하고, 반증된 3단계 OTP 로그인 계약을 문서에서 정정한다 (2026-08-25 HAR 반증 후 재설계 — 마일스톤 최대 리스크 조기 해소 스파이크)
- [ ] **Phase 06: 로그인 방식 선택 UI + 실패 안내** - 사용자가 API/브라우저 로그인 방식을 선택하고 선택값이 영속되며, 선택 시 제약 고지와 한국어 실패 사유를 확인할 수 있다
- [ ] **Phase 07: API 자격 증명 저장 + 토큰 만료 사전 경고** - API 모드 자격증명을 암호화 저장해 재입력을 생략하고, 신청 대기 중 토큰 만료가 예상되면 사전에 재로그인을 유도한다

## Phase Details

### Phase 05: API 로그인 핵심 흐름 + 토큰 교환 검증

**Goal**: 이미 동작 중인 헤드리스 로그인에서 계정 토큰을 확보해 account → 팬이벤트 토큰 사다리(R019)가 실계정에서 성립하는지 1회 관찰로 판정하고, 반증된 로그인 계약을 문서에서 제거한다.
**Depends on**: Phase 04 (M001-ksbtje 완료 — 기존 AuthService/ApplyEngine 기반 위에 구축)
**Requirements**: R017, R019 (R018 은 2026-08-25 보류·매핑 해제)
**Success Criteria** (what must be TRUE):

  1. **[VOID — 2026-08-25 HAR 반증]** 사용자가 API 모드에서 이메일/비밀번호를 제출하면 매번 이메일로 6자리 OTP가 발송된다 (POST /v2/auth/otp-sessions → POST /v4/auth/token/by-credentials, otpSessionId 포함).
  2. **[VOID — 2026-08-25 HAR 반증]** 사용자가 발송된 OTP를 입력하면 POST /v3/auth/token/by-credentials-with-otp 검증을 거쳐 API 로그인이 완료된다.
  3. (이 phase 의 유일한 유효 판정 기준) 로그인 완료 시 확보한 account 토큰이 실계정으로 we2_access_token 교환까지 검증되며(마일스톤 핵심 리스크 조기 해소), ApplyEngine이 이 토큰을 코드 변경 없이 그대로 사용해 신청을 수행할 수 있다.

**Plans**: 3 plans (2026-08-25 재플랜 — 구 05-01(halted)/05-02(blocked)는 무효 전제 위에 있어 폐기·대체됨)
**Wave 1**

- [x] 05-01-PLAN.md — [wave 1] 트레이서: 헤드리스 로그인에서 계정 토큰 확보(쿠키 전량 열거 + CDP 폴백) → R019 사다리 종단 배선 + 관측성/마스킹 하드닝
- [ ] 05-02-PLAN.md — [wave 1] 반증된 로그인 계약 문서 정정: REQUIREMENTS.md R017 서술 교체 · R018 보류(blocked)·매핑 해제 · PROJECT.md/ROADMAP 정합 (D-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 05-03-PLAN.md — [wave 2] R019 실계정 판정 체크포인트(사용자가 로그인 수행, `gate="blocking-human"`) + 05-SPIKE-RESULT.md 확정 · 실패 시 재시도 없이 halt

> **⚠ Phase 05 HALTED (2026-08-25) — 재설계 필요.**
> 실계정 스파이크에서 HAR 증거로 확인: `POST /v4/auth/token/by-credentials` 의 `otpSessionId`
> 필드는 OTP 세션 ID 가 아니라 **reCAPTCHA Enterprise 토큰**(2489자)을 담는다. 실제 브라우저
> 로그인은 `/v2/auth/otp-sessions` 를 호출하지 않으며 **OTP 단계 자체가 없다.** `-25044` 는
> "OTP 필요"가 아니라 "캡차 토큰 없음/무효"다.
> 영향: 위 Success Criteria 1·2 의 전제, R018 의 성립 여부, **구 05-02(폐기됨)** 의 OTP 재발송·만료
> 태스크 전체가 무효. R019 는 로그인이 막혀 도달조차 못 함(미검증).
> 근거 및 정정된 계약: `.planning/phases/05-api/05-01-SUMMARY.md`
> (위 `**Plans**` 목록의 05-01/05-02/05-03 은 2026-08-25 재플랜으로 새로 작성된 것이며,
> halted 상태였던 구 플랜 파일들과는 다른 내용이다.)
> **✅ 2026-08-25 재설계 완료** — Phase 05 는 R019 사다리 검증 스파이크로 재정의되어
> 05-01(계정 토큰 확보 배선)·05-02(본 문서 정정)·05-03(실계정 판정 체크포인트) 3개 플랜으로 재실행된다.

### Phase 06: 로그인 방식 선택 UI + 실패 안내

**Goal**: 사용자가 로그인 방식(API 통신/브라우저)을 명시적으로 선택하고, 선택 시 제약을 사전 고지받으며, 로그인 실패 시 원인을 한국어로 이해할 수 있다.
**Depends on**: Phase 05
**Requirements**: R016, R020, R021
**Success Criteria** (what must be TRUE):

  1. 사용자가 로그인 화면에서 API 통신 또는 브라우저 로그인 방식을 선택할 수 있고, 선택값은 앱을 재시작해도 유지된다 (기본값은 브라우저, 기존 브라우저 로그인 동작은 변경 없이 이 선택기 뒤로 배선됨).
  2. 사용자가 API 모드를 처음 선택하면 "매 로그인마다 이메일 OTP 필요, 자동 재로그인 불가"라는 안내를 확인해야만 진행할 수 있다.
  3. API 로그인이 실패하면 -25003/-25044/-26000/-26004/해외 로그인 차단 등 서버 에러 코드 대신 사용자가 이해할 수 있는 한국어 설명 문구가 표시된다.

**Plans**: TBD
**UI hint**: yes

### Phase 07: API 자격 증명 저장 + 토큰 만료 사전 경고

**Goal**: API 모드 사용자가 매 로그인마다 자격증명을 재입력하지 않아도 되고, 신청 대기 중 토큰이 만료되기 전에 재로그인할 시간을 사전에 확보한다.
**Depends on**: Phase 05, Phase 06
**Requirements**: R022, R023
**Success Criteria** (what must be TRUE):

  1. 사용자가 API 모드로 한 번 로그인하면 이메일/비밀번호는 다음 로그인 시 자동으로 채워져 있고 OTP 코드만 다시 입력하면 된다 (safeStorage 암호화 저장 재사용, OTP 코드 자체는 저장하지 않음).
  2. 신청 예정 시각까지 대기하는 도중 토큰이 만료될 것으로 예상되면, 신청이 실행되기 전에 재로그인 필요 경고가 사용자에게 표시된다.

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 05 → 06 → 07

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 01. s01 | M001-ksbtje | - | Complete | 2026-05-13 |
| 02. s02 | M001-ksbtje | - | Complete | 2026-05-13 |
| 03. s03 | M001-ksbtje | - | Complete | 2026-05-13 |
| 04. s04 | M001-ksbtje | - | Complete | 2026-05-13 |
| 05. API 로그인 핵심 흐름 + 토큰 교환 검증 | v0.3.0 | 0/3 | ○ Ready to execute (재플랜 2026-08-25) | - |
| 06. 로그인 방식 선택 UI + 실패 안내 | v0.3.0 | 0/TBD | Not started | - |
| 07. API 자격 증명 저장 + 토큰 만료 사전 경고 | v0.3.0 | 0/TBD | Not started | - |
