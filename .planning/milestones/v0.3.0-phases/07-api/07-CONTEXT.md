# Phase 07: API 자격 증명 저장 + 토큰 만료 사전 경고 - Context

**Gathered:** 2026-08-27
**Status:** Ready for planning

<domain>
## Phase Boundary

**이 phase가 전달하는 것:** 이미 동작하는 로그인 위에 얹히는 **재입력 생략 계층**과, 신청 대기
중 토큰 만료를 사람이 대응할 수 있게 만드는 **사전 경고 계층**.

1. API 모드에서 한 번 로그인하면 다음 로그인 시 자격증명을 다시 입력하지 않아도 된다 (R023)
2. 신청 대기 중 토큰 만료가 예상되면 신청 실행 전에 경고가 표시되고 재로그인 경로가 열려 있다 (R022)

**이 phase가 전달하지 않는 것:** 새 로그인 경로(두 경로 모두 존재, 06 에서 확정), 자동 재로그인
(D-03 이 두 모드 모두에서 영구 차단), 캡차 우회(R013 영구 제외), 캡차 챌린지 발생 시의 새 복구
매커니즘(06 deferred), rung2 실경로 검증(05 deferred).

---

### ⚠ ROADMAP Success Criteria 1 은 반증된 전제 위에 있다 — D-11 절차로 정정한다

ROADMAP Phase 07 SC1 은 다음과 같이 쓰여 있다:

> "이메일/비밀번호는 다음 로그인 시 자동으로 채워져 있고 **OTP 코드만 다시 입력하면 된다**"

**OTP 단계는 존재하지 않는다.** 05-01 의 HAR 실측(436 entries 중 OTP 관련 호출 0건)으로 반증
됐고, Phase 06 의 D-02 가 관련 코드(`submitOtpApi`, `requestOtpSession`, `verifyOtp`,
`LoginPanel` 의 `needOtp` 화면 전체)를 이미 전량 제거했다. 같은 OTP 서술이 `REQUIREMENTS.md`
R022 / R023 의 `Why it matters` 에도 남아 있다.

**처리:** Phase 06 이 확립한 D-11 절차(삭제 대신 `[VOID]` 마킹 + 정정문 병기)를 그대로 적용한다.
정정 대상 3곳:

| 파일 | 위치 | 반증된 서술 |
|---|---|---|
| `.planning/ROADMAP.md` | Phase 07 SC1 | "OTP 코드만 다시 입력하면 된다" |
| `.planning/REQUIREMENTS.md` | R022 Why it matters | "API 모드는 OTP 때문에 자동 재로그인이 불가능하다" |
| `.planning/REQUIREMENTS.md` | R023 Why it matters | "매번 OTP를 입력해야 하는 것만으로도 번거로운데" |

정정된 SC1: **사용자가 API 모드로 한 번 로그인하면 다음 로그인 시 이메일이 자동으로 채워져 있고,
비밀번호를 다시 입력하지 않고 로그인할 수 있다** (safeStorage 암호화 저장 재사용). 정정된 R022
사유: 자동 재로그인이 불가능한 실제 이유는 OTP 가 아니라 **reCAPTCHA 관문의 예측 불가능성과
D-03 의 무인 로그인 차단 정책**이다.

이건 이 phase 에서 새로 내리는 결정이 아니라 **확립된 절차의 적용**이므로 사용자에게 재확인하지
않았다.

---

### ⚠ SC1 의 "비밀번호가 자동으로 채워져" 와의 의도적 편차 (D-01)

정정된 SC1 조차 "이메일/비밀번호는 자동으로 채워져"라고 읽힐 수 있으나, **D-01 은 비밀번호를
렌더러에 채우지 않는다.** 사용자 체감(재입력 없이 로그인)은 동일하게 충족되지만, password
input 에 실제 값이 들어가지는 않는다. verify 단계는 이를 회귀가 아니라 **의도된 변경**으로
판정해야 한다. 근거는 D-01 에 기록되어 있다.

---

### Phase 06 에서 넘어온 확정 사항 (재논의하지 않음)

- **D-01 (06):** API 모드 = `credentialLogin()` 헤드리스 자동입력 경로. 순수 HTTP 아님.
- **D-03 (06):** 무인 자동 로그인은 **두 모드 모두** 차단. 외부 로그인 요청은 항상 사용자
  클릭에서만 발생. `extractTokenFromCookies()` 세션 복원만 허용.
  - **부수효과 (06-CONTEXT 가 "Phase 07 계획 시 반영할 것"으로 명시):** **R022 의 필요성이
    API 모드 한정에서 두 모드 전체로 확대된다.** 이 phase 의 만료 경고는 API/브라우저 양쪽에
    적용된다.
- **D-05 (06):** 비민감 설정 → `settings.json` 평문. 민감값 → safeStorage.
- **D-11 (06):** 반증된 문서 서술은 삭제 대신 `[VOID]` + 정정문.
- **D-15 (06):** 안내는 인라인 재사용, `role="alert"` 유지. 새 모달/영역을 늘리지 않는다.

</domain>

<decisions>
## Implementation Decisions

### 자동 채움의 신뢰 경계 (R023)

- **D-01:** **비밀번호는 `credentials.enc` 밖으로 나가지 않는다. 렌더러는 이메일만 받는다.**
  프리필은 이메일에만 적용하고, "저장된 비밀번호로 로그인" 신호를 받은 **메인 프로세스가**
  복호화해 `credentialLogin(email, password)` 를 직접 호출한다. 평문 비밀번호는 IPC·렌더러
  메모리·React state 어디에도 존재하지 않는다.
  - 근거: `contextIsolation` 이 켜져 있어도 렌더러로 넘어간 평문은 디버그 덤프·로그·향후
    리팩터링의 노출면이 된다. **IN-02 가 정확히 그 사고였다** — 헤드리스 디버그 덤프의
    `emailValue` 가 `mask.ts` 규칙 부재로 로그에 평문으로 남았다(06-10 에서 폐쇄). 비밀번호에
    같은 일이 생기면 피해 규모가 다르다.
  - D-03(06) 은 유지된다 — main 이 로그인을 수행해도 **트리거는 여전히 사용자 클릭**이므로
    "무인 로그인"이 아니다.
  - **⚠ ROADMAP SC1 문자와의 의도적 편차** — `<domain>` 참조.
  - **Reversibility:** reversible — IPC 계약 한 곳(무엇을 반환하는가)의 변경. 되돌리면 오히려
    노출면이 늘어나는 방향이므로 되돌릴 이유가 없다.

- **D-02:** **기존 2칸 폼을 유지하고 이메일만 채운다.** 새 "저장 계정 카드" 화면을 만들지 않고
  `LoginPanel.tsx` 의 현재 이메일/비밀번호 폼을 그대로 두되, 이메일에 저장값을 프리필하고
  비밀번호 칸 아래에 **"저장된 비밀번호로 로그인"** 보조 버튼을 둔다. 비밀번호 칸에 직접
  입력하면 그 값으로 로그인한다(두 경로가 눈으로 구분된다).
  - 근거: D-15(06) 의 "새 UI 영역/모달을 늘리지 않는다" 를 따른다. `credMessage` /
    `.error-message` 실패 안내 자리와 06 의 `login-panel-view.ts` 순수 함수 구조가 그대로
    살아있다.
  - **Reversibility:** reversible.

- **D-03:** **입력된 이메일이 저장된 이메일과 다르면 저장 비밀번호 경로를 차단한다.**
  불일치 시 "저장된 비밀번호로 로그인" 버튼을 비활성화하고 *"다른 계정입니다 — 비밀번호를
  입력하세요"* 를 안내한다. 저장값은 지우지 않으므로 이메일을 되돌리면 다시 쓸 수 있다.
  - 근거: **05-01 의 실사용 사고 재발 방지.** 당시 모드 게이트 누락으로 저장된 *다른* 계정에
    헤드리스 로그인이 시도되어 실제 알림 메일이 발송됐다. 이제 이메일 칸은 편집 가능한데
    비밀번호는 저장값을 쓰므로, 가드가 없으면 **A 계정 이메일 + B 계정 비밀번호** 조합이
    Weverse 로 나간다.
  - **판정은 메인 프로세스가 최종 게이트로 다시 수행한다** — 렌더러의 `disabled` 만 믿지
    않는다. **WR-03 선례**(06-REVIEW: 버튼 비활성 실패가 관문을 우회한 발견)를 그대로 따른다.
  - **Reversibility:** reversible.

- **D-04:** **복호화 실패는 `ProfileStore` 선례를 따른다 — 삭제 + 명시적 안내.**
  `credentials.enc` 의 복호화/파싱이 실패하면 손상된 파일을 즉시 삭제하고, 빈 폼과 함께
  *"저장된 로그인 정보를 읽지 못해 초기화했습니다 — 다시 입력해주세요"* 를 표시한다.
  - **safeStorage 자체가 불가한 환경은 삭제하지 않는다** — 키체인이 돌아올 수 있으므로 파일을
    보존하고 *"이 환경에서는 저장된 정보를 사용할 수 없습니다"* 만 안내한다. 저장 측은 기존
    동작 유지(경고 로그 후 건너뜀, R023 Notes).
  - 근거: `SettingsStore` 의 "조용히 폴백"은 **비민감 값이기 때문에** 성립한 정책이다(D-05/06).
    민감값은 `ProfileStore` 쪽이 맞다. 또 `hasStoredCredentials()` 가 `true` 인데 로그인이
    안 되는 유령 상태를 없앤다 — 06 을 관통한 "UI 가 거짓말하지 않는다" 기준.
  - **Reversibility:** reversible.

### 저장 제어와 삭제 경로 (R023)

- **D-05:** **저장 동의 UI 를 추가하지 않는다 — 현행대로 로그인 성공 시 항상 저장.**
  `auth-service.ts:422` 의 `saveCredentials()` 호출을 그대로 둔다. R023 은 저장을 요구할 뿐
  동의 절차를 요구하지 않으며, 재입력 생략이 이 phase 의 목표다. 대신 **D-06/D-07 로 통제권과
  가시성을 보장**한다.
  - **Reversibility:** reversible — 체크박스 추가는 나중에도 국소 변경.

- **D-06:** **로그인 상태와 무관하게 자격증명을 삭제할 수 있게 한다** — 06-CONTEXT 가 Phase 07
  후보로 남긴 갭을 여기서 닫는다.
  - 현재 `LoginPanel.tsx:246` 의 "로그아웃 + 자격 증명 삭제"는 `status.isLoggedIn === true`
    일 때만 노출돼, **로그인 실패/미시도 상태에서는 `credentials.enc` 를 앱으로 지울 방법이
    없다.** `hasStoredCredentials()` 가 true 이면 로그인 여부와 무관하게 "저장된 로그인 정보
    삭제"를 노출한다.
  - 이 버튼은 D-03(이메일 불일치)과 D-04(복호화 실패) 안내의 출구이기도 하다 — 두 안내가
    가리킬 곳이 없으면 사용자가 막힌다.
  - **Reversibility:** reversible.

- **D-07:** **저장 사실을 상태문으로 드러낸다.** API 탭에 *"이 기기에 {마스킹된 이메일} 로그인
  정보가 암호화되어 저장되어 있습니다"* 한 줄 + D-06 의 삭제 버튼을 같은 자리에 둔다. 사실과
  통제권이 한 곳에 있다.
  - **⚠ R010 관문:** 표시되는 이메일은 반드시 마스킹을 통과해야 한다. `mask.ts` 에는 **이메일
    전용 규칙이 없다**(IN-02 가 지적한 바로 그 공백). planner 는 마스킹 함수 신설 여부와
    적용 지점을 명시적으로 태스크화할 것.
  - 고지 모달(D-08/D-09/06)에는 손대지 않는다 — 문구를 바꾸면 D-10(06) 에 따라 고지 버전이
    올라가 **기존 사용자 전원에게 재확인 모달이 다시 뜬다.** 그 비용을 이 항목으로 치를
    이유가 없다.
  - **Reversibility:** reversible.

### 만료 판정 기준과 경고 시점 (R022)

- **D-08:** **판정은 JWT `exp` 로컬 계산만으로 한다.** 기존 `isTokenExpired()`
  (`auth-service.ts:1047`)의 파싱 로직을 재사용해 `exp` 시각을 꺼내고, `TimingService` 의 서버
  시간 보정(`offsetMs`)을 적용한 신청 예정 시각과 비교한다. 경고 직전 `GET /fans/me` 검증은
  **하지 않는다.**
  - 근거: `exp` 는 서버가 서명한 값이라 별도 검증이 불필요하고, 외부 호출이 0 이라 신청 직전
    타이밍에 부수효과가 없다.
  - **Reversibility:** reversible.

- **D-09:** **임계는 고정 여유시간 상수.** `exp < 신청예정시각 + N` 이면 "만료 예상"으로
  판정한다. `N` 은 재로그인에 실제로 필요한 시간(헤드리스 로그인 타임아웃 25초 + 캡차 챌린지
  시 브라우저 방식 전환까지)을 근거로 정하고 상수로 고정한다. 사용자 설정 UI 는 만들지 않는다.
  - **Reversibility:** reversible.

- **D-10:** **arm 즉시 경고한다.** `exp` 는 재로그인 전까지 불변이므로 arm 시점에 이미 결론이
  난다 — 대기 중에 새로 알게 되는 정보는 없다. 가장 이른 시점에 알려 최대 대응 시간을 준다.
  경고는 대기 화면에 상주하며 남은 시간을 보여준다. 별도 타이머로 2단계 승격은 하지 않는다.
  - 근거: R022 의 목적은 "사람이 개입할 시간을 미리 확보한다" 이다. 임계 시각에야 띄우면 그
    시점에 사용자가 화면 앞에 없을 때 기회를 놓친다.
  - 재로그인이 발생하면 새 토큰의 `exp` 로 재판정한다.
  - **Reversibility:** reversible.

- **D-11:** **`exp` 를 알 수 없으면 "만료 시각 불명"을 그대로 안내한다.** 토큰이 JWT 가
  아니거나 `exp` 클레임이 없으면 *"토큰 만료 시각을 확인할 수 없습니다 — 신청 직전에 로그인
  상태를 확인해주세요"* 를 표시한다. 경고도 안심도 아닌 제3의 상태이며, 신청을 막지는 않는다.
  - 근거: `isTokenExpired()` 의 "만료 아님으로 가정"(`auth-service.ts:1051,1061`)은 로그인
    유지용으로는 타당하지만, 그 가정을 경고 시스템에 그대로 쓰면 **UI 가 "안전하다"고
    거짓말한다.** 05 관측상 실제 토큰은 3-part JWT 였으므로 흔치 않은 경로다.
  - **Reversibility:** reversible.

### 경고 후 흐름과 토큰 갱신 (R022)

- **D-12:** **경고는 신청을 차단하지 않는다.** arm 도 POST 도 막지 않고, 경고 + 재로그인
  유도까지만 한다.
  - 근거: R022 는 "사전에 경고하고 재로그인을 유도한다" 까지만 요구한다. 이건 선착순
    이벤트이고, **만료 예측이 틀렸는데 앱이 신청을 막으면 R022 가 막으려던 바로 그 피해
    (이벤트를 통째로 놓침)를 앱이 직접 일으킨다.** 최종 판단은 사용자에게 남긴다.
  - **Reversibility:** reversible.

- **D-13:** **POST 직전에 `authService.token` 을 재조회한다.** `apply-engine.ts:146` 이
  실행 시작 시점의 토큰을 지역 변수 `const token` 에 붙잡고 대기 후 `submitApplication(...,
  token, ...)` 에 그대로 넘기는 구조를 고친다 — 대기가 끝난 뒤 payload 빌드 시점에 다시 읽는다.
  - 근거: **이 수정 없이는 D-12 의 "재로그인 유도"가 무의미하다.** 사용자가 경고를 보고
    재로그인해도 새 토큰이 POST 에 반영되지 않아 만료된 토큰으로 쏘게 된다.
  - 재조회 결과가 `null` 이면 기존 `UNAUTHORIZED` 경로로 명확히 실패시킨다.
  - `syncTime(token)` 은 실행 시작 시점 그대로 두어도 무방하다 — 시간 오프셋은 토큰 신원에
    의존하지 않는다.
  - **Reversibility:** reversible — 지역 변수 하나의 읽기 시점 변경.

- **D-14:** **대기 중 재로그인 전에 기존 토큰을 백업하고, 실패하면 복원한다.**
  `credentialLogin()` 은 시작 시 기존 `we2_access_token` 쿠키를 먼저 지우므로, 대기 중
  재로그인이 캡차에 막히면 **곧 만료되지만 아직 유효했던 토큰마저 잃는다.**
  - **복원이 실효적인 근거:** `submitApplication()` 은 쿠키가 아니라
    `Authorization: Bearer ${token}` 헤더를 쓴다(`weverse-api.ts:15`). 쿠키가 지워져도
    메모리에 보관한 이전 토큰으로 신청을 시도할 수 있다.
  - 보장 문장: **"재로그인 시도가 상황을 더 나쁘게 만들지 않는다."**
  - **Reversibility:** reversible.

- **D-15:** **경고는 `ApplyExecution` 대기 화면 인라인에 표시하고, 재로그인 버튼을 경고 안에
  둔다.** 새 모달을 만들지 않는다 — D-15(06) 의 "기존 자리 재사용, `role="alert"` 유지" 를
  그대로 따른다. D-12 로 비차단을 택했으므로 차단형 모달과는 논리가 어긋난다.
  - **Reversibility:** reversible.

### Claude's Discretion

- **고정 여유시간 `N` 의 구체값** — 근거(헤드리스 25초 타임아웃 + 캡차 시 브라우저 전환)는
  정해졌고 숫자는 구현자 재량. 상수로 고정하고 이름에 근거를 남길 것.
- **저장된 이메일을 렌더러로 노출하는 경로** — 기존 `AuthStatus.hasStoredCredentials` 옆에
  필드를 추가할지 `auth:*` 에 새 채널을 열지. `AuthStatus` 는 로그로도 흐르므로 마스킹
  경로를 함께 판단할 것.
- **`mask.ts` 이메일 마스킹 규칙 신설 여부** — D-07 이 마스킹된 이메일을 요구한다. 규칙을
  `mask.ts` 에 추가할지(IN-02 의 근본 해결) 표시 지점에서만 처리할지는 구현자 판단. 다만
  R010 관문 통과는 선택이 아니다.
- **모든 사용자 문구의 최종 카피** — 방향은 각 결정에 명시됐고 문장 다듬기는 재량. 전부 한국어.
- **WR-04 / IN-01 이월 항목의 처리 방식** — 아래 `<code_context>` 참조. 이 phase 가 `settings.json`
  과 IPC 를 다시 건드리므로 함께 닫는 것이 자연스럽다. 별도 플랜으로 뺄지 인접 태스크에 붙일지는
  planner 재량이나, **조용히 누락시키지는 말 것.**

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 이 phase 의 직접 선행 결정 — 최우선 정독
- `.planning/phases/06-ui/06-CONTEXT.md` — **필수.** 이 phase 가 이어받는 15개 결정의 정본.
  특히 **D-03**(무인 로그인 두 모드 차단 + "R022 의 필요성이 두 모드로 확대된다 — Phase 07
  계획 시 반영할 것"), **D-05**(민감/비민감 저장 분리), **D-11**(VOID 마킹 절차),
  **D-15**(인라인 표시 원칙), 그리고 `<deferred>` 의 "로그아웃 UI 갭 — Phase 07 후보"(D-06 이
  해소).
- `.planning/phases/05-api/05-01-SUMMARY.md` — **필수.** HAR 436 entries 로 확정된 실제 로그인
  계약과 **실사용 피해 2건의 경위.** "저장된 다른 계정에 헤드리스 로그인이 시도되어 실제 알림
  메일 발송" 사고가 D-03 의 1차 근거다.

### 정정 대상 문서 (D-11 절차 적용)
- `.planning/ROADMAP.md` Phase 07 — **Success Criteria 1 이 반증된 "OTP 코드만 다시 입력"
  서술을 담고 있다.** `<domain>` 의 정정문 참조. SC1 은 D-01 과도 의도적 편차가 있으므로
  verify 단계는 이 CONTEXT 를 함께 읽어야 한다.
- `.planning/REQUIREMENTS.md` §R022 / §R023 — 이 phase 의 매핑 요구사항. **두 항목의
  `Why it matters` 가 모두 반증된 OTP 서술을 담고 있어 정정 대상.** R023 Notes 의 "safeStorage
  불가 환경에서는 저장을 건너뛴다"는 유효하며 D-04 가 그대로 따른다.

### 유효한 배경 참조
- `.planning/phases/05-api/05-SPIKE-RESULT.md` — R019 실계정 판정. §2 관측 사실(캡차 timeout,
  쿠키 `rt` 후보, 3-part JWT). D-11(exp 불명 경로가 흔치 않음)과 D-14(캡차는 언제든 뜬다)의
  근거.
- `.planning/phases/06-ui/06-REVIEW.md` §WR-03 / §WR-04 / §IN-01 / §IN-02 — **WR-04 와 IN-01 은
  Phase 07 로 명시 이월된 항목**이고, WR-03(버튼 비활성 실패의 관문 통과)은 D-03 이 따르는
  선례, IN-02(디버그 덤프 이메일 평문)는 D-01/D-07 의 마스킹 근거다.
- `.planning/PROJECT.md` — "계정 API 계약(2026-08-25 HAR 실측으로 정정)" 표, "핵심 제약",
  Key Decisions 표.

### 확보 불가 자료
- 사용자 제공 HAR(`full weverse.io.har`, 436 entries) — **저장소에 없다.** `05-01-SUMMARY.md`
  가 유일한 정본 기록이며, 추가 계약 확인이 필요하면 사용자에게 재요청해야 한다.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main/services/auth-service.ts:100` `saveCredentials(email, password)` — **저장은 이미
  구현되어 있다.** `credentialLogin()` 성공 시 `:422` 에서 호출된다. safeStorage 불가 시
  경고 로그 후 건너뛰는 동작도 이미 있다(R023 Notes 와 일치).
- `src/main/services/auth-service.ts:111,119` `clearCredentials()` / `hasStoredCredentials()`
  — D-06 의 재료. 이미 존재하며 IPC 로도 `auth:logout(clearCredentials)` 를 통해 도달 가능.
- `src/main/services/auth-service.ts:1047` `isTokenExpired(token)` — JWT `exp` 파싱. **D-08 은
  이 파싱 로직을 재사용하되 판정 의미를 바꾼다** — "지금 만료됐나"가 아니라 "예정 시각에
  만료돼 있을까". `:1051,1061` 의 "만료 아님으로 가정" 폴백이 D-11 의 분기 지점.
- `src/main/services/profile-store.ts` — **D-04 의 선례 원본.** 복호화 실패 → 파일 삭제 →
  throw 패턴이 그대로 참고 대상.
- `src/main/services/settings-store.ts` — D-05(06) 의 산물. 원자적 쓰기(tmp + rename), 읽기
  실패 조용히 폴백 / 쓰기 실패 전파의 비대칭 정책. **D-04 는 이 정책을 따르지 않는다**(민감값
  이므로 ProfileStore 쪽).
- `src/renderer/components/login-panel-view.ts` — 06 이 신설한 LoginPanel 판단 순수 함수 5개.
  D-02/D-03 의 새 판단(프리필 여부, 이메일 불일치 판정)도 여기에 얹는 것이 일관적이다.
- `src/shared/login-failure.ts` `mapLoginFailure()` — 6가지 실패 신호의 exhaustive switch.
  D-04 의 복호화 실패 안내를 여기 편입할지 검토 대상(새 신호 추가 시 컴파일 타임 안전망).
- `src/shared/mask.ts` — 마스킹 7종 + snake_case URL 쿼리 파라미터 룰. **이메일 전용 규칙은
  없다** — D-07 이 부딪히는 관문.
- `src/main/services/timing-service.ts` — `syncTime()` / `calculateSubmitTime()` /
  `isTimeGuardPassed()`. D-08 의 서버 시간 보정(`offsetMs`) 공급원.

### Established Patterns
- **생성자 주입 fetch** — 모든 HTTP 클라이언트가 `fetchFn` 을 생성자로 받아 테스트에서 mock 주입.
- **순수 함수는 `src/shared/`** — `mask.ts`, `login-failure.ts`, `token-validation-failure.ts`,
  `api-mode-notice.ts` 가 모두 테스트 가능한 순수 모듈. **만료 판정(D-08/D-09/D-11)도 여기가
  적합하다** — `exp` 와 예정 시각과 버퍼를 받아 3상태(안전/경고/불명)를 반환하는 순수 함수.
- **exhaustive switch 로 컴파일 타임 안전망** — `mapLoginFailure()` 가 세운 관례. 새 상태를
  추가하면 누락이 컴파일 에러로 드러난다.
- **단일 관문 신설** — `buildFailureResult()` 가 R010 마스킹의 단일 관문. D-07 의 이메일 표시도
  단일 관문을 거치게 할 것.
- **모드 게이트 방어** — `tryAutoLogin()` / `trySessionRestore()` 최상단 가드. **약화시키지 말 것.**
  D-01 은 이 가드를 우회하지 않는다(트리거가 사용자 클릭이므로 애초에 게이트 대상이 아니다).
- **관측성 우선** — 서버 응답/상태가 기대와 다르면 조용히 넘어가지 않는다. D-04/D-11 이 "조용히
  폴백"을 거부하는 근거.
- **한국어 사용자 문구** — 기존 UI/에러 메시지가 전부 한국어. 새 문구도 동일.

### Integration Points
- `src/main/services/apply-engine.ts:146` `const token = authService.token` — **D-13 의 수정
  지점.** 이 지역 변수가 `:242` 의 `submitApplication(..., token, ...)` 과 `:180` 의
  `_pollStatus(schema, token)` 까지 흘러간다. `:191` 의 `waiting` → `waitUntilSubmitTime()`
  사이에 재로그인이 일어나도 반영되지 않는다.
- `src/main/services/apply-engine.ts:102` `arm()` — **D-10 의 판정 트리거 지점.**
- `src/main/services/auth-service.ts:213` 부근 `credentialLogin()` 시작부의 기존 쿠키 제거 —
  **D-14 의 백업 시점.**
- `src/main/services/weverse-api.ts:13` `commonHeaders(token)` → `Authorization: Bearer` —
  **D-14 복원이 실효적인 근거.** 쿠키가 아니라 헤더로 인증한다.
- `src/main/preload.ts` — `auth:*` / `profile:*` / `apply:*` / `log:*` / `settings:*`.
  D-01(저장 비밀번호로 로그인 신호)과 저장 이메일 조회가 새 채널을 요구할 수 있다.
- `src/renderer/components/LoginPanel.tsx:63,64` `useState("")` × 2 — D-02 의 프리필 지점.
- `src/renderer/components/LoginPanel.tsx:246` `{status.hasStoredCredentials && ...}` — 현재
  이 블록 전체가 `isLoggedIn` 분기 안에 있어 미로그인 시 도달 불가. **D-06 의 수정 지점.**
- `src/renderer/components/ApplyExecution.tsx` — D-15 의 경고 표시 지점.

### 이월된 리뷰 항목 (Phase 06 → 07, 06-REVIEW.md)
- **WR-04:** `settings:set-login-mode` IPC 핸들러가 `mode` 를 런타임 검증하지 않는다
  (`ipc-handlers.ts:118-120`, `settings-store.ts:102-106`). 임의 문자열이 파일에 쓰이고 쓰기는
  "성공"으로 보고된다. 이 phase 가 IPC 를 다시 건드리므로 함께 닫기 좋다.
- **IN-01:** `readSettings()` 의 catch 가 `fs.readFileSync` 실패도 함께 잡는데 로그는 항상
  "파싱 실패"라고 단정한다(`settings-store.ts:64-67`). 원인 중립 문구로 교체하거나 두 단계를
  분리한다.

### 알려진 갭 / 주의
- **`mask.ts` 에 이메일 규칙 부재** — IN-02 가 지적한 공백. D-07 이 마스킹된 이메일을 표시
  하므로 이 phase 에서 정면으로 마주친다.
- **`ProfileStore` fanId 불일치** — 05-SPIKE-RESULT §2 에서 `loaded fanId=6871442` vs 검증된
  `fanId=9415932`. 이 phase 범위 밖이지만 로그인 흐름을 건드리므로 마주칠 수 있다(deferred).
- **CSS 모듈 해시 셀렉터 의존** — `credentialLogin()` 의 DOM 폴링이 Weverse 배포마다 깨질 수
  있다. D-14 의 "재로그인 실패"는 드문 경로가 아니라 **예상해야 하는 경로**다.
- **토큰 실수명 미측정** — `we2_access_token` 의 실제 유효 기간은 관측된 적이 없다. D-09 의
  `N` 은 토큰 수명이 아니라 **재로그인 소요 시간** 기준이므로 이 미지수에 의존하지 않지만,
  researcher 가 05 로그에서 `exp` 실측값을 찾을 수 있으면 D-10 의 경고 빈도 예측에 도움이 된다.

</code_context>

<specifics>
## Specific Ideas

- **"UI 가 거짓말하지 않는다"** — 06 을 관통한 기준이 이 phase 에도 그대로 적용됐다. D-04(유령
  저장 상태 제거), D-07(저장 사실 명시), D-11(만료 불명을 불명이라고 말하기) 셋이 모두 같은
  원칙의 적용이다.

- **"재로그인 시도가 상황을 더 나쁘게 만들지 않는다"** (D-14) — 이 phase 가 새로 세우는 보장
  문장이다. 경고를 보고 사용자가 행동했는데 그 행동 때문에 더 나빠지면 경고 자체가 함정이 된다.

- **가장 눈에 띄는 단일 결함은 D-13 이다.** `apply-engine.ts:146` 의 토큰 캡처를 고치지 않으면
  R022 전체가 **동작하는 것처럼 보이지만 실제로는 아무것도 구하지 못하는** 기능이 된다 —
  경고는 뜨고, 사용자는 재로그인하고, 그런데도 만료된 토큰으로 POST 가 나간다. planner 는
  이것을 이 phase 의 대표 수정 항목으로 다룰 것.

- **05-01 사고의 그림자가 D-03 에 다시 나타났다.** "저장된 자격증명 + 잘못된 대상"이라는 조합이
  이 phase 에서 **다른 형태로**(이메일만 교체된 폼) 재현 가능하다는 점을 논의 중에 발견했다.
  같은 사고가 두 번째 경로로 들어올 수 있다는 것은 가드를 코드 한 곳이 아니라 계약으로 고정해야
  한다는 신호다.

</specifics>

<deferred>
## Deferred Ideas

- **'이 기기에 저장' 동의 체크박스** — D-05 에서 명시적으로 보류. 공용 PC 사용 시나리오가
  실제로 제기되면 그때 추가한다. settings.json 위에 얹으면 되는 국소 변경.
- **만료 임계 버퍼의 사용자 설정 UI** — D-09 에서 보류. R022 가 요구하지 않는 범위.
- **캡차 챌린지 시 헤드리스 창을 `show()` 해 사용자가 직접 풀게 하는 복구 흐름** — 06 에서
  이월된 deferred. D-14 가 이 흐름의 필요성을 더 키웠다(대기 중 재로그인이 캡차에 막히는
  상황이 실제 시나리오가 됐으므로). 별도 phase 후보.
- **rung2(명시적 account→fanevent 토큰 교환) 실경로 검증** — rung1 성공으로 사다리가 조기
  종료돼 한 번도 실행된 적이 없다. (05-SPIKE-RESULT §6)
- **`ProfileStore` fanId 불일치** — `loaded fanId=6871442` vs 검증된 `fanId=9415932`.
  (05-SPIKE-RESULT §2)
- **IN-04 (모달 `max-height`)** — 06-VALIDATION.md Manual-Only Verifications #2 관찰 이후로
  미뤄진 항목. Phase 06 UAT Test 2 실행으로 해소됐다고 STATE.md 에 기록됨 — 재확인만 필요.
- **운영 조치 — 사용자 직접 수행 필요:** 2026-08-25 실계정 관측 당시의 실토큰이
  `~/Library/Application Support/weverse-fanevent-apply/logs/2026-08-25.log` 에 평문으로 남아
  있다. T-05-17 수정(커밋 `186042f`)은 소급 적용되지 않는다. 코드 작업이 아니므로 이 phase 에서
  다루지 않지만, 미해결 상태로 남아 있음을 계속 기록한다.

</deferred>

---

*Phase: 07-api*
*Context gathered: 2026-08-27*
