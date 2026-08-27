# Phase 07: API 자격 증명 저장 + 토큰 만료 사전 경고 - Research

**Researched:** 2026-08-27
**Domain:** Electron 데스크톱 앱 — 기존 safeStorage 암호화 저장/헤드리스 로그인/신청 엔진 위에
얹는 재입력 생략 계층 + 만료 사전 경고 계층 (신규 외부 라이브러리 없음, 순수 내부 배선)
**Confidence:** HIGH — 모든 통합 지점을 이번 세션에서 `Read`로 직접 열어 line-level로 확인했다.
불확실한 항목(고정 여유시간 `N`, D-08/D-10 간 시각 보정 방식)은 아래 `Assumptions Log` /
`Open Questions`에 명시했다.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**⚠ ROADMAP Success Criteria 1 은 반증된 전제 위에 있다 — D-11 절차로 정정한다**

ROADMAP Phase 07 SC1 은 다음과 같이 쓰여 있다:

> "이메일/비밀번호는 다음 로그인 시 자동으로 채워져 있고 **OTP 코드만 다시 입력하면 된다**"

**OTP 단계는 존재하지 않는다.** 05-01 의 HAR 실측(436 entries 중 OTP 관련 호출 0건)으로 반증
됐고, Phase 06 의 D-02 가 관련 코드(`submitOtpApi`, `requestOtpSession`, `verifyOtp`,
`LoginPanel` 의 `needOtp` 화면 전체)를 이미 전량 제거했다.

정정된 SC1: **사용자가 API 모드로 한 번 로그인하면 다음 로그인 시 이메일이 자동으로 채워져 있고,
비밀번호를 다시 입력하지 않고 로그인할 수 있다** (safeStorage 암호화 저장 재사용). 정정된 R022
사유: 자동 재로그인이 불가능한 실제 이유는 OTP 가 아니라 **reCAPTCHA 관문의 예측 불가능성과
D-03 의 무인 로그인 차단 정책**이다.

**⚠ SC1 의 "비밀번호가 자동으로 채워져" 와의 의도적 편차 (D-01)** — 정정된 SC1 조차 "이메일/
비밀번호는 자동으로 채워져"라고 읽힐 수 있으나, D-01 은 비밀번호를 렌더러에 채우지 않는다.
사용자 체감(재입력 없이 로그인)은 동일하게 충족되지만, password input 에 실제 값이 들어가지는
않는다. verify 단계는 이를 회귀가 아니라 **의도된 변경**으로 판정해야 한다.

**Phase 06 에서 넘어온 확정 사항 (재논의하지 않음)**
- **D-01 (06):** API 모드 = `credentialLogin()` 헤드리스 자동입력 경로. 순수 HTTP 아님.
- **D-03 (06):** 무인 자동 로그인은 두 모드 모두 차단. 외부 로그인 요청은 항상 사용자 클릭에서만
  발생. `extractTokenFromCookies()` 세션 복원만 허용. 부수효과: R022 의 필요성이 API 모드
  한정에서 두 모드 전체로 확대된다.
- **D-05 (06):** 비민감 설정 → `settings.json` 평문. 민감값 → safeStorage.
- **D-11 (06):** 반증된 문서 서술은 삭제 대신 `[VOID]` + 정정문.
- **D-15 (06):** 안내는 인라인 재사용, `role="alert"` 유지. 새 모달/영역을 늘리지 않는다.

**자동 채움의 신뢰 경계 (R023)**

- **D-01:** 비밀번호는 `credentials.enc` 밖으로 나가지 않는다. 렌더러는 이메일만 받는다.
  프리필은 이메일에만 적용하고, "저장된 비밀번호로 로그인" 신호를 받은 **메인 프로세스가**
  복호화해 `credentialLogin(email, password)` 를 직접 호출한다. 평문 비밀번호는 IPC·렌더러
  메모리·React state 어디에도 존재하지 않는다.
  D-03(06) 은 유지된다 — main 이 로그인을 수행해도 트리거는 여전히 사용자 클릭이므로 "무인
  로그인"이 아니다. Reversibility: reversible.

- **D-02:** 기존 2칸 폼을 유지하고 이메일만 채운다. 새 "저장 계정 카드" 화면을 만들지 않고
  `LoginPanel.tsx` 의 현재 이메일/비밀번호 폼을 그대로 두되, 이메일에 저장값을 프리필하고
  비밀번호 칸 아래에 "저장된 비밀번호로 로그인" 보조 버튼을 둔다. 비밀번호 칸에 직접 입력하면
  그 값으로 로그인한다(두 경로가 눈으로 구분된다). Reversibility: reversible.

- **D-03:** 입력된 이메일이 저장된 이메일과 다르면 저장 비밀번호 경로를 차단한다. 불일치 시
  "저장된 비밀번호로 로그인" 버튼을 비활성화하고 "다른 계정입니다 — 비밀번호를 입력하세요"
  를 안내한다. 저장값은 지우지 않으므로 이메일을 되돌리면 다시 쓸 수 있다. 근거: 05-01 의
  실사용 사고 재발 방지(저장된 *다른* 계정에 헤드리스 로그인이 시도되어 실제 알림 메일 발송).
  **판정은 메인 프로세스가 최종 게이트로 다시 수행한다** — 렌더러의 `disabled` 만 믿지 않는다
  (WR-03 선례). Reversibility: reversible.

- **D-04:** 복호화 실패는 `ProfileStore` 선례를 따른다 — 삭제 + 명시적 안내. `credentials.enc`
  의 복호화/파싱이 실패하면 손상된 파일을 즉시 삭제하고, 빈 폼과 함께 "저장된 로그인 정보를
  읽지 못해 초기화했습니다 — 다시 입력해주세요" 를 표시한다. safeStorage 자체가 불가한 환경은
  삭제하지 않는다 — 키체인이 돌아올 수 있으므로 파일을 보존하고 "이 환경에서는 저장된 정보를
  사용할 수 없습니다" 만 안내한다. 저장 측은 기존 동작 유지(경고 로그 후 건너뜀). 근거:
  `SettingsStore` 의 "조용히 폴백"은 비민감 값이기 때문에 성립한 정책이다(D-05/06). 민감값은
  `ProfileStore` 쪽이 맞다. `hasStoredCredentials()` 가 true 인데 로그인이 안 되는 유령 상태를
  없앤다. Reversibility: reversible.

**저장 제어와 삭제 경로 (R023)**

- **D-05:** 저장 동의 UI 를 추가하지 않는다 — 현행대로 로그인 성공 시 항상 저장. `auth-
  service.ts:422` 의 `saveCredentials()` 호출을 그대로 둔다. D-06/D-07 로 통제권과 가시성을
  보장한다. Reversibility: reversible.

- **D-06:** 로그인 상태와 무관하게 자격증명을 삭제할 수 있게 한다 — 06-CONTEXT 가 Phase 07
  후보로 남긴 갭을 여기서 닫는다. 현재 `LoginPanel.tsx:246` 의 "로그아웃 + 자격 증명 삭제"는
  `status.isLoggedIn === true` 일 때만 노출돼, 로그인 실패/미시도 상태에서는 `credentials.enc`
  를 앱으로 지울 방법이 없다. `hasStoredCredentials()` 가 true 이면 로그인 여부와 무관하게
  "저장된 로그인 정보 삭제"를 노출한다. 이 버튼은 D-03(이메일 불일치)과 D-04(복호화 실패)
  안내의 출구이기도 하다. Reversibility: reversible.

- **D-07:** 저장 사실을 상태문으로 드러낸다. API 탭에 "이 기기에 {마스킹된 이메일} 로그인
  정보가 암호화되어 저장되어 있습니다" 한 줄 + D-06 의 삭제 버튼을 같은 자리에 둔다. **⚠ R010
  관문:** 표시되는 이메일은 반드시 마스킹을 통과해야 한다. `mask.ts` 에는 이메일 전용 규칙이
  없다(IN-02 가 지적한 바로 그 공백). planner 는 마스킹 함수 신설 여부와 적용 지점을 명시적으로
  태스크화할 것. 고지 모달(D-08/D-09/06)에는 손대지 않는다 — 문구를 바꾸면 D-10(06) 에 따라
  고지 버전이 올라가 기존 사용자 전원에게 재확인 모달이 다시 뜬다. Reversibility: reversible.

**만료 판정 기준과 경고 시점 (R022)**

- **D-08:** 판정은 JWT `exp` 로컬 계산만으로 한다. 기존 `isTokenExpired()`
  (`auth-service.ts:1047`)의 파싱 로직을 재사용해 `exp` 시각을 꺼내고, `TimingService` 의 서버
  시간 보정(`offsetMs`)을 적용한 신청 예정 시각과 비교한다. 경고 직전 `GET /fans/me` 검증은
  하지 않는다. 근거: `exp` 는 서버가 서명한 값이라 별도 검증이 불필요하고, 외부 호출이 0 이라
  신청 직전 타이밍에 부수효과가 없다. Reversibility: reversible.

- **D-09:** 임계는 고정 여유시간 상수. `exp < 신청예정시각 + N` 이면 "만료 예상"으로 판정한다.
  `N` 은 재로그인에 실제로 필요한 시간(헤드리스 로그인 타임아웃 25초 + 캡차 챌린지 시 브라우저
  방식 전환까지)을 근거로 정하고 상수로 고정한다. 사용자 설정 UI 는 만들지 않는다.
  Reversibility: reversible.

- **D-10:** arm 즉시 경고한다. `exp` 는 재로그인 전까지 불변이므로 arm 시점에 이미 결론이 난다.
  경고는 대기 화면에 상주하며 남은 시간을 보여준다. 별도 타이머로 2단계 승격은 하지 않는다.
  근거: R022 의 목적은 "사람이 개입할 시간을 미리 확보한다" 이다. 재로그인이 발생하면 새 토큰의
  `exp` 로 재판정한다. Reversibility: reversible.

- **D-11:** `exp` 를 알 수 없으면 "만료 시각 불명"을 그대로 안내한다. 토큰이 JWT 가 아니거나
  `exp` 클레임이 없으면 "토큰 만료 시각을 확인할 수 없습니다 — 신청 직전에 로그인 상태를
  확인해주세요" 를 표시한다. 경고도 안심도 아닌 제3의 상태이며, 신청을 막지는 않는다. 근거:
  `isTokenExpired()` 의 "만료 아님으로 가정"(`auth-service.ts:1051,1061`)은 로그인 유지용으로는
  타당하지만, 그 가정을 경고 시스템에 그대로 쓰면 UI 가 "안전하다"고 거짓말한다.
  Reversibility: reversible.

**경고 후 흐름과 토큰 갱신 (R022)**

- **D-12:** 경고는 신청을 차단하지 않는다. arm 도 POST 도 막지 않고, 경고 + 재로그인 유도까지만
  한다. 근거: 만료 예측이 틀렸는데 앱이 신청을 막으면 R022 가 막으려던 바로 그 피해(이벤트를
  통째로 놓침)를 앱이 직접 일으킨다. Reversibility: reversible.

- **D-13:** POST 직전에 `authService.token` 을 재조회한다. `apply-engine.ts:146` 이 실행 시작
  시점의 토큰을 지역 변수 `const token` 에 붙잡고 대기 후 `submitApplication(..., token, ...)`
  에 그대로 넘기는 구조를 고친다 — 대기가 끝난 뒤 payload 빌드 시점에 다시 읽는다. 근거: 이
  수정 없이는 D-12 의 "재로그인 유도"가 무의미하다. 재조회 결과가 `null` 이면 기존
  `UNAUTHORIZED` 경로로 명확히 실패시킨다. `syncTime(token)` 은 실행 시작 시점 그대로 두어도
  무방하다. Reversibility: reversible.

- **D-14:** 대기 중 재로그인 전에 기존 토큰을 백업하고, 실패하면 복원한다. `credentialLogin()`
  은 시작 시 기존 `we2_access_token` 쿠키를 먼저 지우므로, 대기 중 재로그인이 캡차에 막히면
  곧 만료되지만 아직 유효했던 토큰마저 잃는다. 복원이 실효적인 근거: `submitApplication()` 은
  쿠키가 아니라 `Authorization: Bearer ${token}` 헤더를 쓴다(`weverse-api.ts:15`). 쿠키가
  지워져도 메모리에 보관한 이전 토큰으로 신청을 시도할 수 있다. 보장 문장: "재로그인 시도가
  상황을 더 나쁘게 만들지 않는다." Reversibility: reversible.

- **D-15:** 경고는 `ApplyExecution` 대기 화면 인라인에 표시하고, 재로그인 버튼을 경고 안에
  둔다. 새 모달을 만들지 않는다. D-12 로 비차단을 택했으므로 차단형 모달과는 논리가 어긋난다.
  Reversibility: reversible.

### Claude's Discretion

- **고정 여유시간 `N` 의 구체값** — 근거(헤드리스 25초 타임아웃 + 캡차 시 브라우저 전환)는
  정해졌고 숫자는 구현자 재량. 상수로 고정하고 이름에 근거를 남길 것.
- **저장된 이메일을 렌더러로 노출하는 경로** — 기존 `AuthStatus.hasStoredCredentials` 옆에
  필드를 추가할지 `auth:*` 에 새 채널을 열지. `AuthStatus` 는 로그로도 흐르므로 마스킹 경로를
  함께 판단할 것.
- **`mask.ts` 이메일 마스킹 규칙 신설 여부** — D-07 이 마스킹된 이메일을 요구한다. 규칙을
  `mask.ts` 에 추가할지(IN-02 의 근본 해결) 표시 지점에서만 처리할지는 구현자 판단. 다만 R010
  관문 통과는 선택이 아니다.
- **모든 사용자 문구의 최종 카피** — 방향은 각 결정에 명시됐고 문장 다듬기는 재량. 전부 한국어.
- **WR-04 / IN-01 이월 항목의 처리 방식** — 이 phase 가 `settings.json` 과 IPC 를 다시
  건드리므로 함께 닫는 것이 자연스럽다. 별도 플랜으로 뺄지 인접 태스크에 붙일지는 planner
  재량이나, 조용히 누락시키지는 말 것.

### Deferred Ideas (OUT OF SCOPE)

- **'이 기기에 저장' 동의 체크박스** — D-05 에서 명시적으로 보류. 공용 PC 사용 시나리오가
  실제로 제기되면 그때 추가한다. settings.json 위에 얹으면 되는 국소 변경.
- **만료 임계 버퍼의 사용자 설정 UI** — D-09 에서 보류. R022 가 요구하지 않는 범위.
- **캡차 챌린지 시 헤드리스 창을 `show()` 해 사용자가 직접 풀게 하는 복구 흐름** — 06 에서
  이월된 deferred. D-14 가 이 흐름의 필요성을 더 키웠다. 별도 phase 후보.
- **rung2(명시적 account→fanevent 토큰 교환) 실경로 검증** — rung1 성공으로 사다리가 조기
  종료돼 한 번도 실행된 적이 없다.
- **`ProfileStore` fanId 불일치** — `loaded fanId=6871442` vs 검증된 `fanId=9415932`.
- **IN-04 (모달 `max-height`)** — Phase 06 UAT Test 2 실행으로 해소됐다고 STATE.md 에 기록됨.
- **운영 조치 — 사용자 직접 수행 필요:** 2026-08-25 실계정 관측 당시의 실토큰이 로그 파일에
  평문으로 남아 있다. 코드 작업이 아니므로 이 phase 에서 다루지 않는다.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| R022 | 신청 시각 전 토큰 수명 체크 및 재로그인 유도 — 신청 예정 시각 기준으로 토큰 잔여 수명을 확인해, 대기 중 만료가 예상되면 사전에 경고하고 재로그인을 유도한다. | `isTokenExpired()`(`auth-service.ts:1047`) 파싱 로직 재사용 지점 확인, `apply-engine.ts` 의 `arm()`(:102)/`execute()`(:143-282) 정확한 라인 매핑, D-13 토큰 재캡처 수정 지점(:146/:193/:242) 확정, D-14 복원 근거(`weverse-api.ts:13` Authorization 헤더 방식) 확인, **App.tsx 의 `LoginPanel` 상시 렌더링과 `token-expired`/`logged-out` 이벤트의 파괴적 네비게이션(:62-74) 발견** — Common Pitfalls 참조. D-08/D-10 간 시각 보정 방식 충돌은 Open Questions 참조. |
| R023 | API 모드 자격증명 암호화 저장 — 이메일/비밀번호를 safeStorage로 암호화 저장해 재입력을 생략한다. OTP 코드는 저장하지 않는다. | 기존 `saveCredentials()`/`clearCredentials()`/`hasStoredCredentials()`(`auth-service.ts:100-121`) 확인, `ProfileStore`(`profile-store.ts`) 의 복호화 실패 → 삭제 패턴이 D-04 의 정확한 선례임을 원문 대조로 확인, `LoginPanel.tsx:228/246/259` 의 정확한 조건부 렌더 구조로 D-06 수정 지점 확정, `IpcApi`/`preload.ts`/`ipc-handlers.ts` 전수 확인으로 D-01 의 신규 IPC 채널 필요성 확정, `mask.ts` 전체 확인으로 이메일 마스킹 규칙 부재(D-07 관문) 재확인. |
</phase_requirements>

## Summary

이 phase는 새로운 외부 라이브러리나 서비스를 도입하지 않는다 — Phase 05/06이 이미 구축한
`safeStorage` 암호화 저장, `credentialLogin()` 헤드리스 로그인, `isTokenExpired()` JWT 파싱,
`ApplyEngine`/`TimingService` 신청 엔진을 그대로 재사용해 두 가지를 배선한다: ① 저장된 자격증명
재사용 시 평문 비밀번호가 IPC/렌더러 경계를 넘지 않는 구조(D-01), ② `arm()` 시점에 토큰 만료를
미리 판정해 대기 화면에 상주 경고를 얹는 구조(D-08~D-15).

가장 중요한 발견은 두 가지다. 첫째, **`apply-engine.ts:146`의 `const token = authService.token`
캡처가 문자 그대로 CONTEXT의 서술과 일치**하며(:193 `waitUntilSubmitTime` 이후, :242
`submitApplication` 이전에 재조회 없이 그대로 흐른다), 이 한 줄을 고치지 않으면 R022 전체가
"경고는 뜨지만 아무것도 구하지 못하는" 기능이 된다. 둘째, **`App.tsx`의 `LoginPanel`은 `step`
상태와 무관하게 항상 렌더링되지만(:170), 이메일/비밀번호 폼 자체는 `!status.isLoggedIn`일 때만
보인다(`LoginPanel.tsx:259`)** — 즉 신청 대기 중(아직 로그인된 것으로 잡히는 토큰이 곧 만료될
때)에는 재로그인 폼이 화면에 없다. D-15의 "경고 안에 재로그인 버튼을 둔다"는 이 갭을 메우기 위한
필연적 설계이지 선택이 아니다 — `ApplyExecution.tsx`가 독자적인 재로그인 트리거 콜백을 `App.tsx`
로부터 받아야 한다. 추가로 `App.tsx:62-74`의 `token-expired`/`logged-out` 이벤트 핸들러가
`setStep("login")` + `setFormSchema(null)`로 화면을 초기화하는 기존 동작이, 대기 중 재로그인
과정에서 의도치 않게 발동하면 armed 상태 자체가 날아갈 위험이 있다 — 이 경로가 대기 중 트리거될
수 있는지 plan에서 명시적으로 검토해야 한다.

**Primary recommendation:** 신규 패키지 없이 3개의 통합 지점(① `auth-service.ts`에 이메일 전용
조회/저장 메서드 추가 + 신규 IPC 채널, ② `src/shared/`에 순수 만료 판정 모듈 신설 후
`apply-engine.arm()`에서 호출, ③ `apply-engine.ts:146` 토큰 재조회 이동)에 집중하고, 렌더러
쪽은 `login-panel-view.ts`/`login-mode-actions.ts`가 확립한 "판단은 순수 함수, 컴포넌트는 분기만"
관례를 그대로 따른다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 이메일 프리필 + "저장된 비밀번호로 로그인" 트리거 | Renderer (LoginPanel.tsx) | Main Process | 렌더러는 표시/클릭 트리거만 담당, 복호화·로그인 실행은 D-01에 따라 Main이 수행 |
| 비밀번호 복호화 및 `credentialLogin()` 실행 | Main Process (auth-service.ts) | — | `safeStorage.decryptString()`은 Node 전용 API. 평문 비밀번호가 IPC 경계를 넘으면 안 됨(D-01) |
| 이메일 불일치 최종 게이트 | Main Process | Shared (순수 판정 함수) | 렌더러 `disabled`만 믿지 않는다 — WR-03 선례(버튼 비활성 실패가 관문을 우회한 발견) |
| 저장된 자격증명 존재/삭제 | Main Process (fs 접근) | Renderer (버튼 표시) | 파일시스템 접근은 Main 전용, 렌더러는 `hasStoredCredentials` boolean만 받음 |
| 토큰 만료 판정 (exp vs 신청예정시각+N) | Shared (신규 순수 모듈) | Main Process (apply-engine.arm()에서 호출) | JWT exp 파싱+시각 비교는 `login-failure.ts`/`token-validation-failure.ts`와 같은 tier의 순수 함수가 적합 — main/renderer 양쪽에서 재사용 가능 |
| 만료 경고 표시 + 재로그인 유도 UI | Renderer (ApplyExecution.tsx) | Main Process (apply:event 발행) | 판정은 Main의 `arm()`이 이벤트로 발행, 표시는 Renderer. 재로그인 실행 콜백은 App.tsx가 소유해야 함(LoginPanel 폼이 로그인 상태에서 숨겨지므로) |
| POST 직전 토큰 재조회 (D-13) | Main Process (apply-engine.execute()) | — | 순수 내부 로직, 외부 노출 없음 |
| 재로그인 실패 시 토큰 백업/복원 (D-14) | Main Process (auth-service.ts) | — | 쿠키/메모리 캐시 상태 관리는 Main 전용 |
| 이메일 마스킹 (R010) | Shared (mask.ts) | Main Process (적용 지점) | R010 단일 관문 원칙 — `buildFailureResult()`가 이미 이 tier 구조를 확립함 |

## Standard Stack

### Core

이 phase는 신규 npm 패키지를 도입하지 않는다. 기존 내부 모듈만 재사용한다.

| 모듈 | 위치/버전 | 용도 | 표준으로 삼는 이유 |
|------|-----------|------|---------------------|
| Electron `safeStorage` | Electron `^33.3.1` (devDependencies, 이미 사용 중) [VERIFIED: package.json] | 자격증명 OS 수준 암호화 저장 | Phase 05(`credentials.enc`)/06(`profile.enc` 패턴 재검증)에서 이미 검증된 경로. `saveCredentials()`/`clearCredentials()`/`hasStoredCredentials()`가 `auth-service.ts:100-121`에 이미 구현되어 있음 [VERIFIED: src/main/services/auth-service.ts:100-121] |
| Node `Buffer`/base64url 수동 파싱 | Node 내장 (Electron 번들) | JWT `exp` 클레임 파싱 | `isTokenExpired()`가 이미 이 방식으로 파싱 중이며(`auth-service.ts:1047-1072`) 서명 검증이 불필요(D-08: "exp는 서버가 서명한 값이라 별도 검증이 불필요") — 별도 JWT 라이브러리를 붙일 이유가 없음 |
| vitest | `^4.1.6` (devDependencies) [VERIFIED: package.json] | 순수 함수 단위 테스트 | 기존 17개 테스트 파일이 전부 이 프레임워크를 쓴다. `vitest.config.ts`가 `src/**/__tests__/**/*.test.ts`만 포함(`.test.tsx` 미포함) [VERIFIED: vitest.config.ts] — 렌더러 JSX 컴포넌트는 자동 테스트 대상이 아니고, 판단 로직을 `*-view.ts` 순수 모듈로 뽑아야 테스트 가능하다는 뜻 |

### Supporting

없음 — 전부 기존 모듈 재사용.

### Alternatives Considered

| 대신 고려한 것 | 대안 | 트레이드오프 |
|----------------|------|--------------|
| 수작업 JWT `exp` 파싱 재사용 | `jsonwebtoken`/`jose` 같은 라이브러리 도입 | D-08이 서명 검증을 명시적으로 배제했고("exp는 서버가 서명한 값이라 별도 검증이 불필요"), 이미 검증된 파싱 로직이 있어 신규 의존성 추가는 순수 비용 증가다. 도입하지 않는다. |
| Main 프로세스가 비밀번호 복호화+로그인 수행 | 렌더러에서 복호화 후 로그인 | D-01이 명시적으로 배제 — IN-02(이메일 평문 로그 유출 사고)가 렌더러/디버그 경로 노출의 실제 피해 사례. Main 처리를 표준으로 한다. |

## Package Legitimacy Audit

이 phase는 신규 외부 패키지를 설치하지 않는다 — 표는 생략한다.

**Packages removed due to [SLOP] verdict:** 없음 (신규 패키지 없음)
**Packages flagged as suspicious [SUS]:** 없음 (신규 패키지 없음)

## Architecture Patterns

### System Architecture Diagram

```
[R023] 저장된 자격증명 재사용 흐름
──────────────────────────────────
LoginPanel.tsx (Renderer)
  │  이메일 input: 마운트 시 저장된 이메일로 프리필
  │  "저장된 비밀번호로 로그인" 버튼 클릭
  ▼
IPC: auth:credential-login-stored(email)   ← 신규 채널, 비밀번호 인자 없음
  │
  ▼
ipc-handlers.ts → auth-service.ts (Main Process)
  │  1) getStoredEmail() 로 저장된 이메일 복호화 (비밀번호는 아직 안 읽음)
  │  2) 입력 email !== 저장 email → 거부 (D-03 최종 게이트, 렌더러 disabled 재확인 아님)
  │  3) 일치 → credentials.enc 전체 복호화 → credentialLogin(storedEmail, storedPassword)
  ▼
CredentialLoginResult { success, reason?, identifier? }   ← 비밀번호 필드 없음, 기존 계약 그대로
  │
  ▼
LoginPanel.tsx: buildFailureView() 등 기존 순수 함수로 렌더링 (변경 없음)


[R022] 만료 사전 경고 흐름
──────────────────────────
ApplyForm.tsx → apply:arm IPC → ApplyEngine.arm() (Main Process)
  │  schema.applyPeriod.startAt 은 이미 fetchForm() 에서 확보됨
  │  authService.token 의 exp 파싱 (기존 isTokenExpired 파싱 로직 재사용)
  │  evaluateTokenExpiry(expMs, startAtMs, N) → "safe" | "warning" | "unknown"  ← 신규 순수 함수 (shared/)
  │  apply:event 로 "token-expiry-checked" 이벤트 발행 (신규 이벤트 타입)
  ▼
App.tsx: handleArmed() 에서 이벤트 수신 → step="apply-execution" 진입 시 상태를 ApplyExecution 에 전달
  ▼
ApplyExecution.tsx (Renderer, D-15 인라인 상주 경고)
  │  "warning"/"unknown" 상태면 role="alert" 배너 + 재로그인 버튼 상시 표시
  │  재로그인 버튼 클릭 → App.tsx 가 소유한 재로그인 콜백 호출
  │    (LoginPanel 의 이메일/비밀번호 폼은 status.isLoggedIn===true 인 동안 숨겨져 있으므로
  │     ApplyExecution 자체가 트리거를 가져야 함 — Common Pitfalls 참조)
  ▼
[사용자 재로그인 성공] → auth-service 새 토큰 캐시
  ▼
ApplyEngine.execute() (사용자가 "신청 실행" 클릭 시)
  │  기존: const token = authService.token  (arm 시점 캡처, apply-engine.ts:146)
  │  waitUntilSubmitTime() 대기 (:193)
  │  ── D-13 수정 지점: 여기서 authService.token 을 다시 읽는다 ──
  │  submitApplication(..., token, ...) (:242) ← 재조회된 토큰 사용
  ▼
POST 제출 (weverse-api.ts: Authorization: Bearer 헤더, 쿠키 무관 — D-14 복원 근거)
```

### Recommended Project Structure

기존 3-tier 구조(`src/main/`, `src/renderer/`, `src/shared/`)를 그대로 따른다. 신규 파일 후보:

```
src/shared/
├── token-expiry.ts          # 신규 — D-08/D-09/D-11 순수 판정 함수 (login-failure.ts와 같은 tier)
├── mask.ts                  # 기존 수정 — 이메일 마스킹 규칙 추가 (D-07)
└── __tests__/
    ├── token-expiry.test.ts # 신규
    └── mask.test.ts         # 기존 수정 — 이메일 케이스 추가

src/main/services/
├── auth-service.ts          # 기존 수정 — getStoredEmail(), D-03 이메일 일치 게이트, D-14 백업/복원
├── apply-engine.ts          # 기존 수정 — arm()에서 evaluateTokenExpiry() 호출 + 이벤트 발행, D-13 토큰 재조회
└── __tests__/
    ├── auth-service.test.ts # 기존 수정
    └── apply-engine.test.ts # 기존 수정

src/renderer/components/
├── login-panel-view.ts      # 기존 수정 — 이메일 불일치 판정 등 새 순수 함수 (D-02/D-03)
├── LoginPanel.tsx           # 기존 수정 — 프리필, D-06 삭제 버튼 재배치, D-07 저장 상태문
└── ApplyExecution.tsx       # 기존 수정 — D-15 인라인 경고 + 재로그인 콜백 prop
```

### Pattern 1: 순수 판정 함수 + exhaustive switch (기존 관례, `token-expiry.ts`에도 적용)

**What:** 상태 판정 로직을 `src/shared/`의 부수효과 없는 함수로 뽑고, 반환 타입을 discriminated
union으로 만들어 소비자가 exhaustive switch로 처리하게 한다.
**When to use:** main과 renderer가 같은 판정 로직을 공유해야 하거나(D-08처럼), 렌더러 JSX
컴포넌트 자체는 자동 테스트 대상이 아니므로(vitest.config.ts가 `.test.tsx`를 포함하지 않음) 판단
로직만이라도 테스트 가능한 형태로 분리해야 할 때.
**Example (기존 코드, `login-failure.ts`의 실제 패턴 — 신규 `token-expiry.ts`도 이 모양을 따를 것):**
```typescript
// Source: src/shared/login-failure.ts (실제 파일, 이 phase가 참고할 기존 패턴)
export type LoginFailureReason =
  | "captcha" | "form-error" | "timeout"
  | "network-error" | "token-ladder-failed" | "unknown";

export function mapLoginFailure(reason: LoginFailureReason, detail?: string): LoginFailureGuidance {
  switch (reason) {
    case "captcha": return { message: "...", suggestBrowserSwitch: true };
    // ... exhaustive, no default — 새 reason 추가 시 컴파일 에러로 누락을 잡는다
  }
}
```
신규 `token-expiry.ts`(D-08/D-09/D-11) 제안 형태 — **이 코드는 저장소에 없는 신규 제안**이며
`isTokenExpired()`(`auth-service.ts:1047-1072`)의 파싱 로직을 재사용해 exp 값만 추출하는 헬퍼를
곁들여야 한다:
```typescript
// 신규 제안 — src/shared/token-expiry.ts
export type TokenExpiryState =
  | { status: "safe" }
  | { status: "warning"; expAt: number }
  | { status: "unknown" };

/** exp가 null(비-JWT/클레임 없음)이면 D-11의 제3상태, 아니면 D-08/D-09 버퍼 비교 */
export function evaluateTokenExpiry(
  expMs: number | null,
  plannedSubmitAtMs: number,
  bufferMs: number,
): TokenExpiryState {
  if (expMs === null) return { status: "unknown" };
  return expMs < plannedSubmitAtMs + bufferMs
    ? { status: "warning", expAt: expMs }
    : { status: "safe" };
}
```

### Pattern 2: strict/safe 이중 액션 분리 (login-mode-actions.ts 선례)

**What:** 같은 부수효과(설정 저장)를 실패 시 삼키는 버전과 던지는 버전으로 나눠, 호출 경로마다
다른 실패 계약을 타입으로 강제한다.
**When to use:** D-01의 "메인이 로그인을 수행한다"처럼, 실패를 반드시 호출자가 알아야 하는
경로(저장된 비밀번호 로그인)와 조용히 넘어가도 되는 경로가 섞일 때 이 분리를 재사용할 수 있다.
**Example:**
```typescript
// Source: src/renderer/login-mode-actions.ts (실제 파일)
const saveModeStrict = async (mode: LoginMode): Promise<void> => {
  await deps.persistLoginMode(mode);   // 실패하면 그대로 throw — 삼키지 않는다
  deps.onModeApplied(mode);
};
const saveModeSafe = async (mode: LoginMode): Promise<void> => {
  try { await saveModeStrict(mode); } catch (err) { deps.onDiagnostic?.(err); /* 배너만 표시 */ }
};
```

### Pattern 3: 삭제-후-재입력 (ProfileStore 선례, D-04가 그대로 따름)

**What:** 민감 파일 복호화/파싱 실패 시 조용히 폴백하지 않고 파일을 삭제 + throw해 유령 상태를
없앤다.
**Example:**
```typescript
// Source: src/main/services/profile-store.ts (실제 파일, D-04의 정확한 선례)
let json: string;
try {
  json = safeStorage.decryptString(buffer);
} catch (err) {
  logService.error("ProfileStore", `복호화 실패 — 프로필 삭제 후 재입력 필요: ${String(err)}`);
  this._deleteFile(filePath);
  throw new Error("프로필 복호화 실패 — 프로필이 초기화되었습니다");
}
```
D-04는 이 패턴을 `credentials.enc`에도 적용하되, "safeStorage 자체가 불가한 환경"은 예외로
삭제하지 않는다는 조건을 추가한다 — `saveCredentials()`의 기존 `isEncryptionAvailable()` 체크
(`auth-service.ts:101-104`)와 대칭을 이루는 조건 분기가 필요하다.

### Anti-Patterns to Avoid

- **렌더러 `disabled` 속성만으로 이메일 불일치를 막는 것 (D-03 경고):** 06-REVIEW.md WR-03이
  정확히 이 패턴의 실패 사례(버튼 비활성 실패가 관문을 우회)를 기록했다. Main이 최종 게이트여야
  한다.
- **비밀번호를 IPC 인자나 React state에 잠깐이라도 통과시키는 것 (D-01 경고):** IN-02(디버그
  덤프의 이메일 평문 로그 유출)가 "잠깐이라도 렌더러/로그 경로를 지나면 언젠가 새어나간다"의
  실제 사례다.
- **`token-expiry.ts`의 판정 결과를 `apply-engine.execute()` 안에서만 계산하는 것:** D-10은
  "arm 즉시"를 요구한다 — execute() 시점(대기 이후)까지 미루면 사람이 개입할 시간이 사라진다.

## Don't Hand-Roll

| 문제 | 만들지 말 것 | 대신 쓸 것 | 이유 |
|------|--------------|------------|------|
| JWT `exp` 파싱 | 새 base64url 디코더/파서 | `isTokenExpired()`(`auth-service.ts:1047-1072`)의 파싱 내부 로직을 추출해 재사용 | 이미 검증됐고 D-08이 명시적으로 "재사용"을 요구함 |
| 자격증명 암호화 | 커스텀 AES/키 관리 | `safeStorage`(OS 키체인/DPAPI) | `ProfileStore`/`AuthService`가 이미 같은 API로 검증됨. WebSearch로 확인한 대로 Windows는 DPAPI, macOS는 Keychain에 위임되는 OS 표준 경로다 |
| 마스킹 관문 | 컴포넌트마다 개별 마스킹 호출 | `mask.ts`의 `maskSensitive()`/`SENSITIVE_PATTERNS` 단일 관문 확장 | R010 "단일 관문" 원칙이 이미 `buildFailureResult()`로 확립됨 — 이메일 규칙도 여기 추가해야 새 노출 지점이 생기지 않음 |

**Key insight:** 이 phase의 위험은 "새로운 기술적 난제"가 아니라 "이미 있는 안전장치를 우회하는
새 경로를 만드는 것"이다. D-03/D-06/D-07이 전부 05-01/06-REVIEW의 실제 사고(다른 계정 헤드리스
로그인, 이메일 평문 로그 유출, 버튼 비활성 우회)를 다시 겪지 않기 위한 설계이므로, 커스텀 해법을
피하는 것 자체가 이 phase의 핵심 안전 요구사항이다.

## Common Pitfalls

### Pitfall 1: `apply-engine.ts:146`의 토큰 캡처를 고치지 않으면 D-13이 무의미해진다
**What goes wrong:** `const token = authService.token`(:146)이 `waitUntilSubmitTime()`(:193)
이전에 한 번만 읽히고, `submitApplication(..., token, ...)`(:242)과 `_pollStatus(schema,
token)`(:281)까지 그대로 흘러간다. 대기 중 사용자가 경고를 보고 재로그인해도 새 토큰이 반영되지
않는다.
**Why it happens:** 지역 변수 하나가 함수 전체 스코프에 살아있는 흔한 JS 패턴 — 리팩터링
없이는 눈에 띄지 않는다.
**How to avoid:** `waitUntilSubmitTime()` 반환 이후, payload 빌드/제출 직전에
`authService.token`을 다시 읽고 `null`이면 `UNAUTHORIZED`로 명확히 실패시킨다(D-13 그대로).
**Warning signs:** apply-engine.test.ts에 "arm 이후 authService.token이 바뀌면 execute()가
새 토큰을 쓴다"는 케이스가 없으면 이 회귀가 재발할 수 있다.

### Pitfall 2: 대기 화면(ApplyExecution)에는 재로그인 폼이 없다 — LoginPanel은 로그인 상태에서 숨는다
**What goes wrong:** `App.tsx:170`의 `<LoginPanel ... />`는 `step`과 무관하게 항상 렌더링되지만
[VERIFIED: src/renderer/App.tsx — `<LoginPanel` 호출이 `step === ...` 조건부 블록 밖, 최상단에
위치], 이메일/비밀번호 입력 폼 자체는 `LoginPanel.tsx:259`의 `{!status.isLoggedIn && (...)}`
안에만 있다 [VERIFIED: src/renderer/components/LoginPanel.tsx:259]. 신청 대기 중에는
`authStatus.isLoggedIn`이 여전히 `true`(토큰이 아직 캐시에 남아있으므로)이기 때문에, 만료가
임박했다는 경고가 떠도 화면 어디에도 로그인 폼이 나타나지 않는다.
**Why it happens:** `isLoggedIn` 게이트는 "이미 로그인된 상태에서는 로그인 폼을 다시 보여줄
필요가 없다"는 전제로 설계됐다 — "곧 만료될 예정인 로그인 상태"라는 제3의 케이스를 원래
고려하지 않았다.
**How to avoid:** D-15가 요구하는 "경고 안의 재로그인 버튼"은 `ApplyExecution.tsx`가 독자적으로
로그인 액션(브라우저 모드면 `handleLogin()`, API 모드면 저장된 자격증명 로그인 액션)을 트리거할
수 있는 콜백을 `App.tsx`로부터 prop으로 받아야 한다는 뜻이다 — LoginPanel의 폼을 가리키는 것만
으로는 요구사항을 충족하지 못한다.
**Warning signs:** 계획에 "ApplyExecution → App.tsx 재로그인 콜백" prop 배선 태스크가 없다면
이 갭이 놓친 것이다.

### Pitfall 3: 기존 `token-expired`/`logged-out` 이벤트 핸들러가 대기 중 화면을 통째로 초기화할 수 있다
**What goes wrong:** `App.tsx:62-65`(`token-expired`)와 `:70-74`(`logged-out`) 핸들러는
[VERIFIED: src/renderer/App.tsx:62-74] 각각 `setStep("login")` + (`logged-out`의 경우)
`setFormSchema(null)`을 실행한다. 만약 D-14의 재로그인 실패 경로나 다른 인증 이벤트가 신청
대기(`apply-execution` step) 도중 이 이벤트를 발생시키면, armed 상태와 `formSchema`가 사라지고
사용자는 처음부터(이벤트 폼 조회부터) 다시 시작해야 한다 — 선착순 이벤트에서는 치명적이다.
**Why it happens:** 이 핸들러들은 Phase 05/06에서 "로그인 실패 = 처음으로 돌아간다"는 전제로
작성됐고, "이미 신청을 준비 중인데 인증 이벤트가 발생한다"는 케이스는 이 phase가 처음 만드는
상황이다.
**How to avoid:** planner는 D-13/D-14의 재로그인 흐름이 이 두 이벤트 중 어떤 것도 발생시키지
않는지(또는 발생시킨다면 `apply-execution` step에서는 이 초기화 로직을 억제하는지) 명시적으로
검토해야 한다. `validateToken()`이 유일하게 `token-expired`를 발생시키는 지점이며
[VERIFIED: src/main/services/auth-service.ts:913] 사용자가 "토큰 검증" 버튼을 수동으로 누를
때만 호출된다는 점도 함께 감안한다.
**Warning signs:** UAT 시나리오에 "대기 화면에서 재로그인 성공/실패 후에도 armed 상태가
유지된다"는 케이스가 없다면 이 위험이 검증되지 않은 것이다.

### Pitfall 4: D-08의 "offsetMs 보정"과 D-10의 "arm 즉시(외부 호출 0)"가 시점상 충돌한다
**What goes wrong:** D-08은 "TimingService의 서버 시간 보정(offsetMs)을 적용한 신청 예정 시각과
비교한다"고 명시하지만, `TimingService.syncTime()`은 `apply-engine.ts`의 `execute()` 내부
1단계에서만 호출된다 — `arm()`(:102)에는 `syncResult`가 아직 존재하지 않는다
[VERIFIED: src/main/services/apply-engine.ts — `arm()`은 :102-125, `syncTime()` 호출은
`execute()` 내부 syncing-time 단계에서만 발생]. D-10은 "arm 즉시" 경고를 요구하므로, arm 시점에
쓸 수 있는 offsetMs가 없다.
**Why it happens:** 두 결정이 각각 다른 관점(정확성 vs 최대 대응 시간 확보)에서 작성됐고, 둘을
동시에 만족시키는 구현 순서가 명시되지 않았다.
**How to avoid:** Open Questions #1 참조 — offsetMs=0(로컬 시각 그대로)으로 arm 시점 경고를
계산하는 것을 권장한다(R003 테스트가 보여주는 오프셋 규모 ±2초는 D-09의 버퍼 N(수십 초 단위)에
비해 무시할 수준).
**Warning signs:** plan에 "arm() 시점에 syncTime()을 추가로 호출한다"는 태스크가 있다면, 이는
D-08의 "외부 호출 0" 취지와 상충할 수 있으므로 CONTEXT 재확인이 필요하다.

### Pitfall 5: `mask.ts`에 이메일 규칙이 없다 — D-07이 이 공백에 정면으로 부딪힌다
**What goes wrong:** `SENSITIVE_PATTERNS`(`mask.ts` 전체, 13개 규칙 + JWT 구조 2차 방어선)에는
이메일 필드를 다루는 규칙이 전혀 없다 [VERIFIED: src/shared/mask.ts 전체 — `password`,
`otpCode`, `applyToken`, `accessToken`, `refreshToken`, `otpSessionId`, snake_case
`access_token`/`refresh_token`/`service_user_id`, `phoneNumber`, `birthDate`,
`membershipNumber`, `firstName`, `lastName`, JWT 구조 정규식만 존재]. D-07이 "이 기기에
{마스킹된 이메일} ... 저장되어 있습니다"를 요구하므로, 이 문구를 만드는 순간 마스킹 함수가
필요해진다.
**Why it happens:** IN-02(06-REVIEW.md)가 지적한 기존 공백이 이번 phase에서 처음으로 실제
요구사항(D-07)과 충돌한다.
**How to avoid:** `mask.ts`에 `maskEmail()` 함수를 신설하거나(권장 — IN-02의 근본 해결과 겹침),
최소한 D-07의 표시 지점에서 로컬파트 마스킹을 적용한다. `SENSITIVE_PATTERNS`의 키-값 문맥
매칭 방식(`(key["']?\s*[:=]\s*["']?)(value)`)과 동일한 관례를 따르는 것이 일관적이다.
**Warning signs:** plan에 마스킹 함수 신설 여부에 대한 명시적 태스크/결정이 없다면 R010 관문을
우회한 채 이메일이 로그/화면에 노출될 위험이 있다.

## Code Examples

### D-13 수정 — 검증된 정확한 위치 (실제 파일, 수정 대상)
```typescript
// Source: src/main/services/apply-engine.ts (실제 파일, execute() 내부)
// 현재 (146행) — arm 이후 execute() 시작 시점에 한 번만 캡처됨
const token = authService.token;
if (!token) {
  this._emitError("execute", "UNAUTHORIZED", "로그인이 필요합니다");
  this._setPhase("error");
  throw new WeverseApiError("UNAUTHORIZED", "로그인이 필요합니다");
}
// ... (193행) await this.timing.waitUntilSubmitTime(submitTimeMs); ← 대기, 여기서 시간이 흐른다
// ... (242행) const submitResult = await this.api.submitApplication(
//   schema.applyHost, schema.artistCode, schema.eventPublicId,
//   token,                              // ← D-13: 이 token은 여전히 146행의 stale 값
//   schema.applyToken, payload,
// );

// D-13 수정 제안: waitUntilSubmitTime() 이후, payload 빌드 직전에 재조회
await this.timing.waitUntilSubmitTime(submitTimeMs);
const freshToken = authService.token;              // 신규 — 대기 이후 재조회
if (!freshToken) {
  this._emitError("execute", "UNAUTHORIZED", "로그인이 필요합니다");
  this._setPhase("error");
  throw new WeverseApiError("UNAUTHORIZED", "로그인이 필요합니다");
}
// 이하 submitApplication/_pollStatus 호출에는 freshToken을 사용
```

### D-14 복원 근거 — 확인된 인증 헤더 방식
```typescript
// Source: src/main/services/weverse-api.ts:13-18 (실제 파일)
function commonHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,   // 쿠키가 아니라 헤더 — D-14 복원이 실효적인 근거
    "X-FEV-APP-SOURCE": "FAN_EVENT",
    Accept: "application/json, text/plain, */*",
  };
}
```

### D-08 기반 재사용 대상 — 기존 파싱 로직 (수정하지 않고 재사용/추출)
```typescript
// Source: src/main/services/auth-service.ts:1047-1072 (실제 파일)
isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) { /* ... assuming not expired ... */ return false; }
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
    ) as { exp?: number };
    if (typeof payload.exp !== "number") { /* ... assuming not expired ... */ return false; }
    const expMs = payload.exp * 1000;
    return expMs < Date.now();
  } catch (err) { return false; }
}
// D-08/D-11 재사용 방향: 위 파싱 부분(parts.length===3 체크 + base64url 디코드 + payload.exp
// 추출)을 별도 헬퍼로 뽑아 exp 원시값(ms | null)을 반환하게 하고, isTokenExpired()와 신규
// evaluateTokenExpiry() 양쪽이 그 헬퍼를 공유하도록 하는 것을 권장한다 — "만료 아님으로 가정"
// 폴백은 isTokenExpired() 전용으로 남기고, 신규 판정 함수는 null을 그대로 "unknown"으로 전달해
// D-11의 요구("만료 아님으로 가정"을 경고 시스템에 재사용하지 않는다)를 지킨다.
```

## State of the Art

| 이전 접근 | 현재(이 phase 이후) 접근 | 변경 시점 | 의미 |
|-----------|---------------------------|-----------|------|
| 매 로그인마다 이메일/비밀번호 재입력 (Phase 06까지) | 이메일 자동 프리필 + "저장된 비밀번호로 로그인" 버튼 (D-01/D-02) | Phase 07 | 비밀번호는 여전히 재사용되지만 IPC/렌더러 경계를 넘지 않는 구조로 재사용됨 |
| 만료된 토큰으로 그대로 POST 시도 (Phase 05/06 상태 — `apply-engine.ts:146`이 stale 토큰을 캡처) | 대기 완료 직후 토큰 재조회 (D-13) | Phase 07 | 재로그인이 실제로 신청 결과에 반영됨 |
| 토큰 만료를 사후(POST 401)에만 인지 | `arm()` 시점 사전 경고 (D-10) | Phase 07 | 사람이 개입할 시간이 사전에 확보됨 |

**Deprecated/outdated:** 없음 — 이 phase는 기존 코드를 삭제하지 않고 확장한다(D-11 VOID 절차
대상은 문서 서술이지 코드가 아님).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | 고정 여유시간 `N`을 예컨대 40~60초 범위로 설정하는 것이 "헤드리스 25초 타임아웃 + 캡차 시 브라우저 전환" 근거에 부합한다는 구체적 숫자 제안 | Common Pitfalls, Code Examples 배경 | N이 너무 작으면 경고 후에도 재로그인이 제시간에 끝나지 않아 D-09의 취지가 무력화됨. N이 너무 크면 불필요하게 자주 "만료 예상" 경고가 뜬다. 실측 토큰 수명이 없어(05-SPIKE-RESULT에 exp 실측값 없음) 검증 불가 — planner/discuss-phase에서 사용자 확인 필요 |
| A2 | D-08의 "offsetMs 보정"을 arm 시점에는 생략(offsetMs=0)하고 D-09의 버퍼 N으로 흡수하는 것이 합리적이라는 권장 | Pitfall 4, Open Questions #1 | 실제로는 D-08이 arm 시점에도 별도 syncTime() 호출을 의도했을 수 있다 — 그렇다면 "외부 호출 0"이라는 D-08의 명시적 근거와 충돌하므로 discuss-phase에서 재확인이 필요 |
| A3 | ApplyExecution.tsx가 App.tsx로부터 재로그인 콜백을 prop으로 받는 것이 D-15를 만족하는 유일한 실용적 방법이라는 아키텍처 판단 | Pitfall 2, Architecture Patterns 다이어그램 | LoginPanel의 조건부 렌더링 자체를 바꿔(예: isLoggedIn이어도 "곧 만료" 상태면 축소된 재로그인 폼을 보여주는 방식) 문제를 해결할 수도 있다 — 두 접근 모두 유효하며 planner가 UI-SPEC 수준에서 선택해야 한다 |

## Open Questions

1. **D-08의 offsetMs 보정과 D-10의 arm-즉시-경고(외부 호출 0)가 시점상 어떻게 공존하는가**
   - What we know: `TimingService.syncTime()`은 `execute()` 내부에서만 호출되고 `arm()`에는
     `syncResult`가 없다(`apply-engine.ts` 코드 구조로 확인). D-08은 offsetMs 보정을 요구하고,
     D-10은 arm 즉시 경고 + D-08의 "외부 호출 0" 근거를 함께 명시한다.
   - What's unclear: arm 시점에 쓸 offsetMs가 애초에 존재하지 않는데, 이 값을 "적용"하라는 D-08의
     지시를 문자 그대로 구현할 방법이 코드 구조상 없다.
   - Recommendation: arm 시점 판정은 offsetMs=0(로컬 시각)으로 계산하고, R003 검증에서 관측된
     오프셋 규모(±2초 대)가 D-09의 버퍼 N(수십 초 단위 예상)에 비해 무시 가능하다는 점을
     근거로 삼을 것을 권장한다. 이 해석이 D-08의 의도와 다르다면 discuss-phase에서 명시적으로
     재확인해야 한다.

2. **고정 여유시간 `N`의 구체적 초 단위 값**
   - What we know: 헤드리스 로그인 타임아웃이 25000ms로 코드에 확인됐다(`auth-service.ts:363`).
     캡차 발생 시 사용자가 브라우저 모드로 전환해 완료하는 시간은 코드로 측정 불가능한
     사람의 반응 시간이다.
   - What's unclear: "브라우저 방식 전환까지"의 소요 시간을 초 단위로 어떻게 근거 있게
     정할지 — 05-SPIKE-RESULT.md에도 실측값이 없다.
   - Recommendation: N을 보수적으로 크게 잡을 것(예: 60초 이상)을 권장한다 — D-12가 "경고는
     신청을 차단하지 않는다"를 이미 보장하므로, N이 다소 과하게 커도(경고가 조금 더 자주 뜨는
     정도) 실질적 피해가 없다. 반대로 N이 작으면 경고 자체가 무의미해질 위험이 크다(비대칭
     리스크).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Electron `safeStorage` (macOS Keychain / Windows DPAPI) | R023 저장/재사용, D-04 | ✓ (Phase 05/06에서 이미 검증) | Electron 33.3.1 | D-04: 저장 시 불가하면 저장 건너뜀(경고 로그), 읽기 시 불가하면 파일 보존 + 안내(삭제하지 않음) |
| vitest | 단위 테스트 | ✓ | ^4.1.6 | — |

**Missing dependencies with no fallback:** 없음.

**Missing dependencies with fallback:** `safeStorage.isEncryptionAvailable()`가 Windows에서
특정 조건(예: 앱이 아직 ready 상태가 아니거나, 그룹 정책으로 DPAPI가 제한된 환경)에서 `false`를
반환할 수 있음이 Electron 공식 문서/이슈에서 확인된다 [CITED: electronjs.org/docs/latest/api/
safe-storage] — 이미 D-04/기존 `saveCredentials()`가 이 케이스를 "저장 건너뜀 + 안내"로 다루고
있으므로 이 phase가 추가로 처리할 신규 리스크는 아니지만, R008(Windows .exe 배포)과 맞물려 QA
시나리오에 포함시킬 가치가 있다.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.6 [VERIFIED: package.json] |
| Config file | `vitest.config.ts` — `include: ["src/**/__tests__/**/*.test.ts"]` (`.test.tsx` 미포함) [VERIFIED: vitest.config.ts] |
| Quick run command | `npx vitest run src/shared/__tests__/token-expiry.test.ts` (신규 파일 기준, 파일명은 planner 재량) |
| Full suite command | `npm test` (= `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|--------------|
| R022 | `evaluateTokenExpiry()` 3상태 판정(safe/warning/unknown) | unit | `npx vitest run src/shared/__tests__/token-expiry.test.ts` | ❌ Wave 0 |
| R022 | `arm()` 호출 시 만료 판정 이벤트가 발행된다 | unit (기존 파일 확장) | `npx vitest run src/main/services/__tests__/apply-engine.test.ts` | ⚠️ 기존 파일에 케이스 추가 필요 |
| R022 | `execute()`가 `waitUntilSubmitTime()` 이후 갱신된 `authService.token`을 사용한다(D-13 회귀 방지) | unit (기존 파일 확장, `authService.token` mock을 wait 중간에 변경) | `npx vitest run src/main/services/__tests__/apply-engine.test.ts` | ⚠️ 기존 파일에 케이스 추가 필요 |
| R022 | 재로그인 실패 시 기존 토큰이 복원된다(D-14) | unit (기존 파일 확장) | `npx vitest run src/main/services/__tests__/auth-service.test.ts` | ⚠️ 기존 파일에 케이스 추가 필요 |
| R023 | 이메일만 프리필하고 비밀번호는 IPC로 나가지 않는다 | unit (`login-panel-view.ts` 신규 순수 함수) | `npx vitest run src/renderer/components/__tests__/login-panel-view.test.ts` | ⚠️ 기존 파일에 케이스 추가 필요 |
| R023 | 이메일 불일치 시 저장 비밀번호 로그인 최종 게이트가 Main에서 차단된다(D-03) | unit | `npx vitest run src/main/services/__tests__/auth-service.test.ts` | ⚠️ 기존 파일에 케이스 추가 필요 |
| R023 | `credentials.enc` 복호화/파싱 실패 시 삭제 + throw(D-04) | unit | `npx vitest run src/main/services/__tests__/auth-service.test.ts` | ⚠️ 기존 파일에 케이스 추가 필요 |
| R023 | 이메일 마스킹 규칙(D-07) | unit | `npx vitest run src/shared/__tests__/mask.test.ts` | ⚠️ 기존 파일에 케이스 추가 필요 |
| R022/R023 | LoginPanel 프리필/D-06 삭제 버튼 노출 위치/ApplyExecution 인라인 경고 렌더링 | manual-only (JSX 컴포넌트, vitest.config.ts가 `.tsx` 미포함) | 없음 — UAT로만 검증 | 해당 없음 |

### Sampling Rate
- **Per task commit:** 해당 태스크가 건드린 파일의 quick run command
- **Per wave merge:** `npm test` (전체 스위트)
- **Phase gate:** `npm test` + `npm run typecheck` + `npm run typecheck:main` green 확인 후
  `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/shared/__tests__/token-expiry.test.ts` — R022 신규 순수 모듈 커버
- [ ] `src/shared/__tests__/mask.test.ts`에 이메일 마스킹 케이스 추가 — R023/D-07
- [ ] `src/main/services/__tests__/apply-engine.test.ts`에 D-10(arm 시 경고 이벤트)/D-13(토큰
      재조회) 케이스 추가
- [ ] `src/main/services/__tests__/auth-service.test.ts`에 D-03(이메일 불일치 게이트)/D-04
      (복호화 실패 삭제)/D-14(백업/복원) 케이스 추가
- [ ] `src/renderer/components/__tests__/login-panel-view.test.ts`에 D-02/D-03 판단 함수 케이스
      추가
- [ ] 프레임워크 설치: 불필요 — 기존 vitest 재사용

*(렌더러 JSX 컴포넌트 자체(LoginPanel.tsx/ApplyExecution.tsx)는 기존 관례상 자동 테스트 대상이
아니며 UAT로만 검증된다 — 이는 이 phase가 새로 만드는 갭이 아니라 저장소 전체의 기존 패턴이다.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | yes | 저장된 자격증명 재사용은 `safeStorage`(OS 자격증명 저장소) 경유만 허용, 평문 비밀번호는 어떤 계층 경계도 넘지 않음(D-01) |
| V3 Session Management | yes | JWT `exp` 클레임 기반 사전 만료 판정(D-08~D-11) — 세션 수명 인지 및 사용자 안내 |
| V4 Access Control | no | 단일 사용자 데스크톱 앱, 다중 사용자 권한 분리 없음(R012가 다계정 자동 신청을 이미 out-of-scope로 배제) |
| V5 Input Validation | yes | 신규 IPC 채널(`auth:credential-login-stored` 등)의 payload 런타임 검증 필요 — WR-04(기존 `settings:set-login-mode` 미검증 이슈)와 같은 패턴이 재발하지 않도록 함께 처리 |
| V6 Cryptography | yes | `safeStorage`(OS 네이티브 암호화) 그대로 사용, 커스텀 암호화 절대 구현하지 않음 |

### Known Threat Patterns for Electron 데스크톱 앱 (자격증명 저장 + 만료 경고)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| 평문 비밀번호가 IPC/렌더러/로그 경로로 유출 (IN-02 실제 사고 선례) | Information Disclosure | D-01: 비밀번호는 Main 프로세스 내부에서만 취급, 렌더러/IPC 계약에서 완전히 배제 |
| 저장된 *다른* 계정에 자동입력 로그인 시도 (05-01 실제 사고) | Tampering / 계정 오적용 | D-03: Main이 이메일 일치를 최종 게이트로 재검증(렌더러 disabled만 믿지 않음, WR-03 선례) |
| `credentials.enc` 손상 파일로 인한 유령 상태(존재하지만 못 읽음) | Denial of Service (사용성) | D-04: ProfileStore 선례(복호화/파싱 실패 시 삭제 + 명시적 안내) |
| 이메일 평문 로그/화면 노출 (D-07이 요구하는 표시가 마스킹 없이 구현될 경우) | Information Disclosure | `mask.ts`에 이메일 규칙 신설 또는 표시 지점 마스킹 적용(R010 단일 관문 원칙 확장) |
| 만료된 토큰으로 POST 제출 → 실패 또는 (더 나쁘게) 예측 불가능한 서버 응답 | 로직 결함 (STRIDE 외곽, 가용성/정합성) | D-13: 대기 후 토큰 재조회. 기존 `postSubmitted` 단일 POST 가드(R007)와 조합해 이중 안전망 유지 |
| 신규 IPC 채널의 입력 검증 부재 (WR-04와 같은 유형) | Tampering | 신규 채널(`auth:credential-login-stored` 등)에도 `settings:set-login-mode`가 놓친 런타임 타입 검증을 함께 적용(WR-04 gap closure와 동일 원칙) |

## Sources

### Primary (HIGH confidence)
- `src/main/services/auth-service.ts` (전체, 특히 :46-145, :204-266, :390-440, :1040-1082) — 이번 세션 `Read`로 직접 확인
- `src/main/services/apply-engine.ts` (전체) — 이번 세션 `Read`로 직접 확인, 정확한 line 매핑 확보
- `src/main/services/weverse-api.ts` (전체) — `commonHeaders()` Authorization 헤더 방식 확인
- `src/main/services/timing-service.ts` (전체) — `syncTime()`이 `arm()`이 아닌 `execute()`에서만 호출됨을 확인
- `src/shared/mask.ts` (전체) — 이메일 마스킹 규칙 부재를 전체 파일 열람으로 확인
- `src/shared/login-failure.ts`, `src/shared/token-validation-failure.ts` — 순수 판정 모듈 패턴 확인
- `src/renderer/components/LoginPanel.tsx`, `login-panel-view.ts` (전체) — 조건부 렌더 구조 line-level 확인
- `src/renderer/components/ApplyExecution.tsx` (전체) — 대기 화면 상태 흐름 확인
- `src/renderer/App.tsx` (관련 구간) — LoginPanel 상시 렌더링, token-expired/logged-out 핸들러 확인
- `src/renderer/login-mode-actions.ts` (전체) — strict/safe 액션 분리 패턴 확인
- `src/main/services/profile-store.ts`, `settings-store.ts` (전체) — D-04/D-05 선례 확인
- `src/main/preload.ts`, `ipc-handlers.ts`, `src/shared/types.ts` (전체) — IPC 계약 전수 확인
- `.planning/phases/07-api/07-CONTEXT.md` — 이 phase의 확정 결정(D-01~D-15) 전체
- `.planning/phases/06-ui/06-REVIEW.md` — WR-01~04, IN-01~04 전체 (이월 항목 근거)
- `.planning/REQUIREMENTS.md` — R022/R023 원문 및 Notes
- `.planning/STATE.md` — Phase 05/06 완료 상태 및 이월 항목 확인
- `package.json`, `vitest.config.ts` — 버전/테스트 설정 확인

### Secondary (MEDIUM confidence)
- [Electron safeStorage 공식 문서](https://www.electronjs.org/docs/latest/api/safe-storage) — Windows/macOS/Linux 플랫폼별 `isEncryptionAvailable()` 동작 차이 확인(WebSearch로 교차 확인)

### Tertiary (LOW confidence)
- 없음 — 이 phase는 전부 기존 코드베이스 내부 배선이라 외부 저확신 출처에 의존할 부분이 없다.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — 신규 의존성 없음, 기존 코드 전량 열람으로 재사용 지점 확정
- Architecture: HIGH — 모든 통합 지점(라인 번호 포함)을 이번 세션에서 직접 확인
- Pitfalls: HIGH — Pitfall 1/2/3/5는 코드 열람으로 직접 발견한 실제 구조적 문제, Pitfall 4는 CONTEXT.md 두 결정의 명시적 서술 대조로 발견
- 고정 여유시간 `N`, D-08/D-10 시각 보정 방식: LOW — 실측 데이터 부재로 discuss-phase 재확인 권장(Assumptions Log A1/A2)

**Research date:** 2026-08-27
**Valid until:** 이 phase 실행 전까지 유효(코드베이스 내부 배선 연구이므로 외부 라이브러리
버전 만료 개념이 적용되지 않음). 단, Phase 07 실행 전에 코드가 추가로 변경되면 line 번호
재확인 필요.
