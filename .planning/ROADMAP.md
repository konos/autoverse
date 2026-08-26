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

- [x] **Phase 05: API 로그인 핵심 흐름 + 토큰 교환 검증** - 이미 동작하는 헤드리스 로그인에서 계정 토큰을 확보해 account→팬이벤트 토큰 사다리(R019)가 실계정에서 성립하는지 판정하고, 반증된 3단계 OTP 로그인 계약을 문서에서 정정한다 (2026-08-25 HAR 반증 후 재설계 — 마일스톤 최대 리스크 조기 해소 스파이크) (completed 2026-08-25)
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
- [x] 05-02-PLAN.md — [wave 1] 반증된 로그인 계약 문서 정정: REQUIREMENTS.md R017 서술 교체 · R018 보류(blocked)·매핑 해제 · PROJECT.md/ROADMAP 정합 (D-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-03-PLAN.md — [wave 2] R019 실계정 판정 체크포인트(사용자가 로그인 수행, `gate="blocking-human"`) + 05-SPIKE-RESULT.md 확정 · 실패 시 재시도 없이 halt

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
     > **⚠ 의도적 편차 (D-03, 근거: `.planning/phases/06-ui/06-CONTEXT.md`):** "기존 브라우저
     > 로그인 동작은 변경 없이"는 이 phase 에서 **의도적으로 위반**된다 — 브라우저 모드의 저장된
     > 자격증명 기반 무인 자동 로그인(`tryAutoLogin()`/`tryAutoRelogin()`)도 함께 제거되기
     > 때문이다. 근거는 05-01 에서 실제로 발생한 사고(모드 게이트 누락으로 저장된 다른 계정에
     > 헤드리스 로그인이 시도되어 실제 알림 메일 발송)와 reCAPTCHA 챌린지가 언제든 인터랙티브로
     > 뜰 수 있다는 예측 불가능성이다. verify 단계는 이 편차를 회귀가 아니라 **의도된 변경**으로
     > 판정해야 한다.

  2. **[VOID — 2026-08-25 HAR 반증]** 사용자가 API 모드를 처음 선택하면 "매 로그인마다 이메일 OTP 필요, 자동 재로그인 불가"라는 안내를 확인해야만 진행할 수 있다.
     **정정된 기준 (2026-08-26, D-08/D-09/D-11):** 사용자가 API 모드를 처음 선택하면 ① Weverse
     보안 확인 시 로그인이 실패할 수 있고 브라우저 방식을 써야 한다는 점 ② 자동 재로그인이 없다는
     점 — 두 가지 고지를 확인해야만 진행할 수 있다. "확인해야만 진행"이라는 차단 요건 자체는
     유지된다. 근거: `.planning/phases/05-api/05-01-SUMMARY.md` (HAR 436 entries, OTP 관련 호출
     0건).

  3. **[VOID — 도달 불가]** API 로그인이 실패하면 -25003/-25044/-26000/-26004/해외 로그인 차단 등 서버 에러 코드 대신 사용자가 이해할 수 있는 한국어 설명 문구가 표시된다.
     **정정된 기준 (2026-08-26, D-12):** 위 코드들은 D-02 가 제거하는 순수 HTTP 경로에서만
     발생해 도달 불가하다. 실제로는 `credentialLogin()` 헤드리스 경로의 6가지 실패 신호(캡차 /
     폼 오류 / 타임아웃 / 네트워크·런타임 오류 / 토큰 사다리 실패 / 미매핑)를 사용자가 이해할 수
     있는 한국어 설명 문구로 표시한다.

**Plans**: 5/7 plans executed (2026-08-26 계획 — 트레이서 선행 + 웨이브 5단계)
**UI hint**: yes

**Wave 1** *(병렬 3개 — 파일 겹침 없음)*

- [x] 06-01-PLAN.md — [wave 1] **트레이서**: 로그인 방식 선택 영속 종단 슬라이스(settings.json → settings:* IPC → 탭) + 고지 확인 상태 영속 + 저장 실패 롤백 (D-04/D-05/D-06/D-07/D-10)
- [x] 06-02-PLAN.md — [wave 1] 실패 신호 → 한국어 안내 순수 매핑 `src/shared/login-failure.ts` (D-12/D-13/D-14, R020)
- [x] 06-03-PLAN.md — [wave 1] 반증된 문서 서술 정정: REQUIREMENTS R020/R021 · ROADMAP 성공 기준 VOID 마킹 + 정정문 (D-11)

**Wave 2** *(06-01·06-02 완료 후)*

- [x] 06-04-PLAN.md — [wave 2] 반증된 계정 API 로그인 코드 제거 + 자격증명 로그인 단일 경로 확정 + 무인 자동 로그인 가드 재정의 (D-01/D-02/D-03)

**Wave 3** *(06-04 완료 후)*

- [x] 06-05-PLAN.md — [wave 3] 캡차 오분류 수정 + 실패 사유·마스킹된 식별자 종단 배선 (D-13/D-12, R010 관문)

**Wave 4** *(06-05 완료 후)*

- [ ] 06-06-PLAN.md — [wave 4] 렌더러 완성: 차단형 고지 모달 · 환경변수 잠금 배지 · 상시 안내 배너 · 실패 안내 렌더링 (D-06/D-08/D-09/D-15, R021)

**Wave 5** *(전체 완료 후)*

- [ ] 06-07-PLAN.md — [wave 5] phase 게이트(테스트 + 타입체크 2종 + 빌드) + 자동화 불가 4항목 UAT 등록

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
| 05. API 로그인 핵심 흐름 + 토큰 교환 검증 | v0.3.0 | 3/3 | Complete    | 2026-08-25 |
| 06. 로그인 방식 선택 UI + 실패 안내 | v0.3.0 | 5/7 | In Progress|  |
| 07. API 자격 증명 저장 + 토큰 만료 사전 경고 | v0.3.0 | 0/TBD | Not started | - |
