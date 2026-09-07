# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v0.3.0 — 로그인 방식 선택 (API / 브라우저)

**Shipped:** 2026-09-07
**Phases:** 3 (05·06·07) | **Plans:** 20 | **Tasks:** 48

### What Was Built

- **로그인 방식 선택 (R016)** — `settings.json` 영속 + `AUTOVERSE_LOGIN_MODE` 환경변수 잠금. 디스크→main→IPC→렌더러 탭까지 한 경로로 배선하고, 저장 실패 시 탭 상태가 거짓말하지 않도록 편도(success-only) 갱신을 채택했다.
- **실패 안내 단일 관문 (R020)** — `classifyCredentialLoginSignal()` 순수 분류 함수 + `mapLoginFailure()` exhaustive switch 로 6개 실패 사유를 확정 한국어 문구에 고정. `buildFailureResult()` 가 모든 message/identifier 를 마스킹으로 강제 통과시킨다.
- **차단형 고지 모달 (R021)** — 네이티브 `<dialog>.showModal()`. 이 저장소 최초의 모달 컴포넌트.
- **API 자격증명 암호화 저장 (R023)** — safeStorage 저장 + `credentials.enc` 4상태 계약 + main 프로세스 이메일 불일치 최종 게이트 + in-flight 가드 + 실패 시 토큰 복원.
- **토큰 만료 사전 경고 (R022)** — `token-expiry.ts` 순수 판정 → `arm()` 즉시 경고 → 대기 화면 인라인 배너 → 대기 중 재로그인 → 재로그인 완료 시 자동 재판정.
- **R019 사다리 판정** — 실계정 1회 관측으로 rung1(직접 사용) 성립 확인.

### What Worked

- **트레이서 우선 배치.** Phase 07 은 07-01 에서 `token-expiry.ts` → `arm()` → 이벤트 → 대기 화면 배너까지 세로 슬라이스를 먼저 관통시킨 뒤 웨이브로 넓혔다. 종단 경로가 1일차에 살아 있으면 이후 플랜이 "이 배선이 실제로 닿는가"를 다시 묻지 않아도 된다.
- **순수 함수로 판단 로직을 뽑아낸 뒤 테스트가 그 모듈을 직접 import.** `login-panel-view.ts`, `auth-event-navigation.ts`, `token-expiry.ts`, `login-mode-actions.ts` — 복제본이 아니라 배포되는 코드를 검증한다. `.tsx` 가 자동 테스트 대상 밖인 이 저장소에서 이 패턴이 커버리지를 실질적으로 지탱했다.
- **단일 관문 수렴 패턴.** `buildFailureResult()`(마스킹), `completeCredentialLoginSuccess()`(저장), `_evaluateCurrentTokenExpiry()`(판정), `setLoginMode()`(검증). 세 번째 호출 경로가 생겨도 관문을 우회할 수 없다 — WR-02 를 한 줄 추가가 아니라 관문 수렴으로 닫은 판단이 특히 그랬다.
- **반증된 서술을 삭제 대신 [VOID] 마킹 + 정정문 병기.** 왜 틀렸는지가 남아야 재발을 막는다. 05-01 이 이 원칙을 실증했고 Phase 06·07 이 그대로 이어받았다.
- **위협 모델을 PLAN 시점에 작성.** `/gsd-secure-phase` 가 소급 감사(retroactive-STRIDE)가 아니라 "계획된 완충재가 실제 코드에 있는가" 검증으로 축소됐다. Phase 06 44건 · Phase 07 30건 모두 `threats_open: 0`.

### What Was Inefficient

- **문서가 코드보다 넓게 틀렸다.** `otpSessionId` 를 OTP 세션 ID 로 읽은 번들 분석 오독 하나가 REQUIREMENTS/PROJECT/ROADMAP 세 문서와 요구사항 2건(R017/R018)에 전파돼 있었다. HAR 실측 한 번이 이를 뒤집었고, Phase 05 의 상당 부분이 코드가 아니라 문서 정정에 쓰였다. **번들 분석은 계약을 확정하지 못한다 — 실측 트래픽만 확정한다.**
- **UAT 가 사람 확인 전용으로 몰렸다.** `vitest.config.ts` 의 include 가 `.test.ts` 만이라 `.tsx` 렌더러 컴포넌트에 자동 회귀망이 없다. Phase 07 UAT 6항목 전부가 이 때문에 수동이 됐다. include 확장은 마일스톤 내내 미뤄졌다.
- **gap closure 가 두 페이즈에서 반복됐다.** Phase 06 은 3개(CR-01/CR-02 + 마스킹 우회 3곳), Phase 07 은 2개(CR-01, WR-02/WR-03). 두 경우 모두 근본 원인이 같았다 — **"성공 경로가 둘인데 사후 처리가 한쪽에만 있다"**. 06 의 `validateToken()` 네 실패 지점과 07 의 `credentialLogin()` 두 성공 분기가 같은 형태다. 계획 단계에서 "이 함수의 반환 경로가 몇 개인가"를 세는 습관이 있었다면 조기에 잡혔다.
- **스테일 클로저를 실행 중에야 발견했다.** 07-05 의 `onAuthEvent` 가 마운트 1회성 `useEffect([])` 안에 있어 `step` 이 영구히 `"login"` 이었다. 고치지 않았다면 Pitfall 3 방어가 코드상으로만 존재했을 것이다. 리뷰가 아니라 실행이 잡아낸 결함이다.
- **traceability 표가 두 마일스톤에 걸쳐 방치됐다.** M001 종료 시 R006/R008/R010 이 `active`/`unmapped` 로 남았고, Phase 06/07 완료 후에도 R016/R020/R021/R022/R023 이 `active` 그대로였다. 마일스톤 종료 시점에야 일괄 정정했다.

### Patterns Established

- **단일 관문(single gate) 수렴** — 같은 사후 처리가 필요한 경로가 둘 이상이면 관문 함수로 수렴시키고, 관문을 거치지 않으면 성공 값을 구성할 수 없게 타입으로 봉인한다.
- **순수 판단 함수 + 직접 import 테스트** — UI 판단 로직을 `*-view.ts` / `*-navigation.ts` 로 분리해 렌더링 없이 전수 검증한다.
- **[VOID] 마킹 + 정정문 병기** — 반증된 문서 서술은 삭제하지 않는다.
- **렌더러 `disabled` 는 관문이 아니다** — 외부에 요청을 발생시키는 결정은 항상 main 이 다시 판정한다(D-03, 05-01 사고 이후 확립).
- **PLAN 시점 위협 모델** — `<threat_model>` 블록을 계획에 쓰고, `/gsd-secure-phase` 는 그 완충재의 존재를 검증한다.

### Key Lessons

1. **리버싱한 계약은 실측 트래픽으로만 확정된다.** 번들 분석은 필드 *이름* 은 주지만 *의미* 는 주지 않는다. `otpSessionId` 가 캡차 토큰이었다는 사실은 HAR 캡처 전까지 드러날 방법이 없었고, 그 사이 요구사항 2건이 존재하지 않는 기능 위에 세워졌다.
2. **함수의 성공 경로를 세어라.** 이 마일스톤의 gap closure 5건 중 3건이 "경로가 둘인데 처리가 한쪽에만" 형태였다. 계획 리뷰에 "이 함수에서 `success: true` 를 반환하는 지점이 몇 개인가"를 넣으면 잡힌다.
3. **자동 테스트가 닿지 않는 층은 UAT 부채로 축적된다.** `.tsx` include 확장을 미룬 대가가 Phase 07 에서 수동 UAT 6항목으로 청구됐다. 다음 마일스톤 초반에 갚는 편이 싸다.
4. **경고는 정보이지 차단이 아니다(D-12).** 만료 판정이 틀렸을 때 사용자가 신청 자체를 못 하게 되는 것이, 만료된 토큰으로 실패하는 것보다 나쁘다. 선착순 도메인에서는 이 우선순위가 반대로 서기 쉽다.
5. **불가능으로 판명된 요구사항은 미완성이 아니다.** R017/R018 을 `active` 로 계속 끌고 가면 매 마일스톤 종료가 실패처럼 보인다. "대상이 존재하지 않음"과 "아직 못 함"을 표에서 구분하는 것이 정확하다.

### Cost Observations

- Sessions: 정확한 집계 없음 — 커밋 157개(feat 31)가 14일에 분포.
- Model mix: 프로필 기준 planner=opus / checker=sonnet / auditor=sonnet. 실제 사용 비율은 미계측.
- Notable: 신규 외부 의존성 0건으로 마일스톤 전체를 마감했다 — `T-07-SC`(공급망) 인수 근거가 매 플랜에서 `package.json` diff 0 으로 실제 확인됐다.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| M001-ksbtje | 4 | — | 초기 MVP — 슬라이스 단위 실행 |
| v0.3.0 | 3 | 20 | 트레이서 선행 + 웨이브 병렬화 도입, PLAN 시점 위협 모델, gap closure 루프(`--gaps-only`) 정착 |

### Cumulative Quality

| Milestone | Tests | src LOC | Zero-Dep Additions | threats_open |
|-----------|-------|---------|--------------------|--------------|
| M001-ksbtje | 163 | — | — | — |
| v0.3.0 | 474 | 12,188 | 0 | 0 (Phase 06·07 양쪽) |

### Top Lessons (Verified Across Milestones)

1. **실측이 추론을 이긴다** — M001 의 `applyHost` 동적 추출(하드코딩 금지)과 v0.3.0 의 HAR 계약 정정이 같은 교훈이다. 서버가 실제로 무엇을 보내는지는 관측해야 안다.
2. **단일 관문이 흩어진 `if` 보다 강하다** — M001 의 `maskSensitive` 7종 마스킹, v0.3.0 의 `buildFailureResult()` / `completeCredentialLoginSuccess()`. 새 경로가 추가될 때 누락되지 않는 구조가 검증보다 싸다.
