# R019 실계정 판정 결과 — account 토큰 → 팬이벤트 토큰 교환 사다리

**판독 대상 로그:** `~/Library/Application Support/weverse-fanevent-apply/logs/2026-08-25.log`
(시작 마커: 29줄, 이번 로그인 시도분은 30줄부터 100줄까지)

---

## 1. 판정 (Verdict)

**`PASS`** — `acquireFaneventToken()` 사다리의 **rung1(직접 사용)이 실계정으로 통과**해
`fanId`를 확보했다. 로그 원문(마스킹 상태 그대로, 값 없이 형태만):

```
accountTokenLadderSpike: verdict=pass tokenSource=cookie ladderSource=direct fanId=9415932 reason=ok
```

R019(account 토큰 → 팬이벤트 토큰 교환)는 이번 관측으로 **검증됨**. 다만 아래 3절에서
서술하듯, rung1이 성공한 경로는 사전 예상(05-RESEARCH Open Question 3: "rung1 통할 가능성은
낮다")과 반대였고, rung2(교환)는 실행 기회 자체가 없었다 — 이는 "성공"이지 "완전한 사다리
검증"은 아니다.

---

## 2. 관측 사실

### 로그인 시도 횟수에 대한 투명한 기록

로그에는 `credentialLogin(headless): starting`이 **2회** 등장한다(09:41:03, 09:41:38).
소스 코드(`src/main/services/auth-service.ts`, `src/main/ipc-handlers.ts`,
`src/renderer/components/LoginPanel.tsx`)를 확인한 결과 `credentialLogin()`에는 내부 자동
재시도 로직이 없다 — 즉 `auth:credential-login` IPC 호출이 렌더러에서 2회 발생했다는 뜻이며,
이는 로그인 버튼이 사용자에 의해 2회 클릭됐음을 시사한다. 실행자(에이전트)는 Task 2
체크포인트에서 "완료" 응답 전까지 사용자에게 어떤 재시도도 요청하지 않았다 — 이 2회는
체크포인트 대기 중 사용자 쪽에서 자체적으로 일어난 것으로 보인다(1차 시도가 26초 만에
`result=timeout`으로 종료된 뒤 2차 시도가 시작됨).

**사다리(`accountTokenLadderSpike`) 자체는 정확히 1회만 실행됐다** — 사다리는
`credentialLogin()`의 `result==="token"` 분기에서만 트리거되는데, 1차 시도는 `timeout`으로
종료돼 이 분기에 도달하지 못했고, 2차 시도만 `result=token`에 도달해 사다리가 1회 실행됐다.
이 플랜의 acceptance criteria가 요구하는 "재시도 0회"는 **사다리 재시도(반증 후 재관찰)**를
가리키며, 이 사다리는 반증되지 않았고 재관찰도 없었다 — 이 기준은 충족된다. 다만 로그인
폼 제출 자체가 2회였다는 사실은 숨기지 않고 그대로 기록한다.

### Task 1 (A) 5개 항목 판정 여부 재확인

이번 판독 구간(30~100줄) 전체를 검사한 결과, 에이전트가 실행한 어떤 명령에도 실계정 도메인
이메일(`@gmail.com` 등)이 인자로 들어가지 않았다. `credentialLogin(headless): input state`
로그는 길이만 기록한다(`email=20 chars, pw=15 chars`) — 헤드리스 브라우저 자체가 앱 코드로
필드를 채운 것이며, 에이전트가 값을 다루지 않았다.

### 쿠키 열거 (Pattern 1 — 경로 A)

- `accountTokenDiscovery: partition=persist:weverse cookies=83` — 로그인 성공 세션에서 83개
  쿠키가 열거됐다.
- **계정 토큰 후보:** `accountTokenDiscovery: candidate=rt@accountapi.weverse.io len=451`.
  후보는 발견됐다 — "후보 없음" 케이스가 아니다.
- 인벤토리 안에서 `.weverse.io` 도메인의 `we2_access_token`(len=427)/`we2_refresh_token`
  (len=451)은 그대로 존재하지만, 판별 로직(`pickAccountTokenCookie`)은 이들을 계정 토큰
  후보로 선택하지 않았다 — `accountapi.weverse.io` 도메인의 `rt` 쿠키(httpOnly=true)가
  선택됐다. 이는 05-01 설계 의도(팬이벤트 토큰과 다른 도메인의 계정 토큰을 구분)와 일치한다.
- **중요 관찰:** `rt`의 길이(451자)는 05-01-SUMMARY.md가 HAR로 확정한 `by-credentials`
  응답의 `refreshToken` 필드 길이(451자)와 정확히 일치한다(`accessToken`은 427자). 즉 이번에
  cookie 경로로 확보돼 rung1에 공급된 값은 **account access 토큰이 아니라 account refresh
  토큰일 가능성이 높다.** 그럼에도 서버(`/fans/me`)는 이 값을 유효한 Bearer로 받아들였다 —
  이 사실 자체가 이번 관측의 핵심 발견이다(4절 참고).

### CDP 폴백 (Pattern 2 — 경로 B)

- 1차 시도: `attach ok` → `responseSeen status=200`(requestId 16진수 포맷, 문서 요청으로
  추정) → `getResponseBody failed: No resource with given identifier found` → 이어서
  `responseSeen status=400`(추정: 캡차 관련 부수 요청) → 26초 후 `result=timeout` →
  `detached reason=target closed`.
- 2차 시도: `attach ok` → `responseSeen status=200`(16진수 requestId, 1차와 동일 패턴으로
  실패) → **`responseSeen status=200`(점 포함 숫자 requestId, 실제 `by-credentials` XHR로
  추정) → `accessToken captured parts=3 len=427 looksLikeJwt=true` — CDP 캡처 성공.**
- CDP가 성공적으로 캡처한 이 `accessToken`(427자, JWT 형태)은 쿠키 경로에서 후보가 이미
  발견됐기 때문에 사다리에 실제로 공급되지는 않았다(설계대로 쿠키 우선). 즉 이번 관측에서
  **경로 A(쿠키)와 경로 B(CDP) 둘 다 유효한 계정 토큰 후보를 각자 확보했고, 서로 다른 값
  (kind: refresh vs access)을 반환했다** — 이 또한 새로운 발견이다.
- `detached reason=target closed`는 양쪽 시도 모두 정상 종료 사유로 나타났다(에러 아님).

### 토큰 shape 및 사다리 결과

- rung1에 공급된 토큰: `parts=3 len=451 looksLikeJwt=true matchesWe2Cookie=false` (JWT 구조,
  팬이벤트 쿠키와 불일치 — 계정 도메인의 별도 토큰임을 재확인).
- **rung1(직접 사용):** `acquireFaneventToken rung1(direct)` 호출 → `/fans/me` `GET` →
  **`200 OK`, body `{"fanId":9415932}`** → `acquireFaneventToken rung1 succeeded
  fanId=9415932`.
- **rung2(교환):** **실행되지 않았다** — rung1이 성공해 사다리가 조기 종료됐다. `exchangeForService()`
  응답 키 목록은 이번 관측으로 확보되지 않았다(Open Question 2는 여전히 미확인, 3절 참고).
- 최종 `fanId`: **확보됨 (9415932)**, 이후 3회 반복된 `validateToken` 호출에서도 동일하게
  `200 OK fanId=9415932`로 일관됐다(캐시/재검증 경로 회귀 없음).

### 별도 관찰 — ProfileStore의 fanId 불일치 (범위 밖, 기록만)

`ProfileStore` 로그: `loaded fanId=6871442` — 사다리가 검증한 `fanId=9415932`와 **다른 값**이다.
`ProfileStore`는 이전 세션(또는 다른 계정)의 캐시된 프로필 파일을 디스크에서 읽어온 것으로
추정되며, 이번 스파이크가 만든 회귀는 아니다(스파이크는 `authService.token`을 덮어쓰지
않는 읽기 전용 경로 — objective에 명시). 이 phase의 스코프 밖이므로 고치지 않는다. Phase 06/07
계획 시 `ProfileStore`가 어느 시점에 갱신되는지 확인할 후보로 남긴다.

---

## 3. 미지수 해소 현황

### Open Questions (05-RESEARCH.md)

| # | 질문 | 상태 | 근거 |
|---|------|------|------|
| 1 | 계정 토큰 쿠키의 실제 이름은? | **확인됨** | `rt` (domain=`accountapi.weverse.io`, len=451, httpOnly=true). 다만 길이가 HAR상 `refreshToken`(451자)과 일치해 실제로는 refresh 토큰일 가능성이 높다 — "계정 access 토큰 쿠키"라는 가정 자체가 부분적으로 반증됨(2절 참고) |
| 2 | `by-access-token` 200 응답의 필드 스키마는? | **여전히 미확인** | rung2가 실행되지 않아 관측 기회가 없었다 |
| 3 | rung1(직접 사용)이 성공할 가능성은? | **반증됨(예상과 반대)** | 05-RESEARCH는 "낮다"고 예상했으나 이번 관측에서 rung1이 실제로 성공했다 |

### Assumptions Log (05-RESEARCH.md)

| # | 주장 | 상태 | 근거 |
|----|------|------|------|
| A1 | CDP `getResponseBody`는 `loadingFinished` 이후 호출해야 body가 완전하다 | **부분 확인** | 코드는 명시적 `loadingFinished` 대기 없이 즉시 시도한다. 무관한 응답(문서 요청으로 추정)에서는 실제로 "No resource with given identifier found" 실패가 재현됐다 — A1이 우려한 실패 모드 자체는 실재함. 그러나 실제 `by-credentials` XHR 응답에서는 우연히(혹은 타이밍상) 성공했다(`accessToken captured`). 결론: 실패 모드는 확인됐지만 이번엔 필요한 응답에서 성공했으므로 근본적 타이밍 수정이 필요한지는 여전히 결론 내리기 이르다 |
| A2 | 계정 토큰 쿠키의 존재 여부와 이름은 실측 전까지 알 수 없다 | **확인됨(존재함)** | `rt@accountapi.weverse.io`, len=451, httpOnly=true — 후보 없음 케이스가 아니었다 |
| A3 | `by-access-token` 응답 필드 스키마가 `by-credentials`와 동일하다 | **여전히 미확인** | rung2 미실행 — 검증 기회 자체가 없었다 |
| A4 | `X-ACC-SERVICE-ID`(departure) 값 `"weverse"`가 올바르다 | **여전히 미확인** | rung2 미실행 — 검증 기회 자체가 없었다 |
| A5 | 계정 토큰/교환된 토큰이 JWT(점 3개) 구조다 | **확인됨** | 쿠키 후보(`rt`, parts=3, len=451)와 CDP 캡처값(parts=3, len=427) 모두 `looksLikeJwt=true` |

**쿠키 후보 미발견 vs CDP 미관측 구분:** 이번 관측에서는 둘 다 해당하지 않는다 — **쿠키 후보는
발견됐고(`rt`), CDP도 실제로 관측·캡처에 성공했다**(`accessToken captured`). "판정 불가"
상황 자체가 발생하지 않았으므로 원인 미상으로 뭉갤 대상이 없다. 굳이 구분해 기록하자면:
CDP 경로에서 첫 번째 `responseSeen(200)` 캡처 시도는 실패했으나(무관한 리소스로 추정), 두
번째 `responseSeen(200)`에서 성공했다 — "CDP 관측 자체가 실패"한 것이 아니라 "여러 후보 응답
중 하나는 실패, 하나는 성공"이었다.

---

## 4. 로드맵 Success Criteria 3에 대한 판단

`/fans/me` `GET` 200 응답이 `{"fanId":9415932}` 형태로 왔고, 이는 기존 브라우저 모드에서
`authService.token`이 `/fans/me`를 통해 검증되는 것과 **동일한 응답 스키마**다. `ApplyEngine`은
`authService.token`(문자열)만 소비하며 토큰의 출처(브라우저 쿠키 vs 계정 API 사다리)를 구분하지
않는다 — 따라서 **형태상으로는 `ApplyEngine`이 코드 변경 없이 소비 가능하다고 판단한다.**

다만 이는 **형태(shape) 수준의 판단**이지 실제 배선 테스트는 아니다 — 이 스파이크는
`authService.token`을 덮어쓰지 않는 읽기 전용 설계이므로(objective 명시), `ApplyEngine`이 이
사다리가 확보한 토큰을 실제로 신청 흐름에 사용하는 종단 시나리오는 검증되지 않았다.

`matchesWe2Cookie=false`가 시사하는 바: 사다리가 확보한 토큰(`rt`, 계정 도메인)은 기존
브라우저 모드가 쓰는 `we2_access_token`(팬이벤트 도메인)과 **다른 값**이다. 두 토큰이 별개의
값인데도 둘 다 `/fans/me`에서 유효하다는 것은, 서버가 "팬이벤트 전용 토큰"과 "계정 레벨
토큰(아마도 refresh)"을 같은 엔드포인트에서 동일하게 인가한다는 뜻이며, 이는 05-RESEARCH가
전제하지 않았던 서버 동작이다.

**회귀 확인:** `npx vitest run src/main/services/__tests__/apply-engine.test.ts` → **17/17
PASS**. Success Criteria 3 관련 회귀 없음.

---

## 5. 에이전트 안전 프로토콜 기록

Task 1 (A)의 5개 항목 판정 결과(이번 05-03 실행분, Task 1이 이미 기록한 것을 그대로 인용):

1. 실서버 프로브에 실제 이메일 미사용 — **확인함**. 이번 05-03 실행(Task 1~3) 전체에서
   에이전트가 직접 실행한 명령 중 `@gmail.com` 등 실계정 도메인 이메일이 인자로 들어간
   사례는 0건이다.
2. 사용자에게 이메일/비밀번호를 요청하지 않음 — **확인함**.
3. `credentials.enc` 내용을 읽거나 복호화하지 않음 — **확인함**. 존재 여부/수정 시각만
   확인했다(Task 1 기록: 확인 시점 기준 **존재하지 않았음** — 다른 계정으로의 자동 로그인
   위험 없음).
4. 사람이 수행하는 실계정 로그인에는 더미 이메일 규칙을 적용하지 않음 — **해당없음/확인함**
   (실계정 로그인은 계획대로 사용자가 앱 UI로 직접 수행했다).
5. 로그인 자동화 시도 없음(캡차는 실제 로그인 페이지가 처리) — **확인함**.

**에이전트가 이 phase(05-01~05-03) 전체에서 직접 실행한 실서버 프로브 건수: 0건.**
(05-01에서 있었던 1건의 실이메일 오용 프로브는 이 phase가 아니라 이전 phase의 Process
Issue이며, 05-01-SUMMARY.md에 이미 별도로 기록되어 있다 — 이 문서가 다시 반복하지 않는다.)
이번 05-03 실행 중 에이전트가 실행한 자동화 명령은 `npm run build`, `npm test`, 특정 vitest
파일 실행, `grep`/`wc -l`/`ls -l`/`tail` 뿐이며 어떤 것도 외부 서버로 HTTP 요청을 보내지
않았다.

---

## 6. 다음 단계 (이 phase에서 실행하지 않음)

이 phase는 스파이크이며(D-04), 아래는 **관찰된 사실이 아니라 다음 단계 제안**이다. 이 phase
에서 실행하지 않는다.

- **rung2(교환) 경로 자체가 아직 한 번도 실행되지 않았다.** Open Question 2/A3/A4는 여전히
  미확인 상태로 남는다. rung1이 이번엔 성공했지만, 서버 측 토큰 회전 정책이나 다른 계정
  상태에서는 rung1이 실패해 rung2로 넘어가는 경우가 있을 수 있다 — 그 경우를 대비해 rung2가
  실제로 동작하는지는 **여전히 미검증**임을 API 모드 제품 경로 결정 시 감안해야 한다.
- `X-ACC-SERVICE-ID`(departure) 값 `"weverse"`의 대체 후보 실험은 필요 없어 보이지만(rung1이
  성공했으므로), 확정은 아니다.
- **보안 관련 발견 — 이 plan의 스코프 밖(코드 변경 금지 제약)이라 고치지 않고 기록만 한다:**
  `credentialLogin(headless)`가 남기는
  `credentialLogin(headless): navigated to https://weverse.io/loginResult?...` 로그 줄에는
  URL 쿼리 파라미터로 `access_token=`/`refresh_token=`/`service_user_id=`가 **마스킹되지
  않은 원문으로** 포함된다. `src/shared/mask.ts`의 `SENSITIVE_PATTERNS`는 `accessToken`/
  `refreshToken`(카멜케이스, `key:value`/`key=value` 형태)만 매칭하며, URL 쿼리스트링의
  스네이크케이스 `access_token=`/`refresh_token=`는 매칭하지 않는다. 이 로그 줄은 실계정의
  실제 accessToken/refreshToken 원문을 로컬 로그 파일에 평문으로 남긴다 — **이번 판정 문서에는
  그 값을 옮겨 적지 않았지만, 앱 자체의 로그 파일에는 여전히 남아 있다.** 이 phase는 코드를
  바꾸지 않는다는 제약(plan-level verification #5) 때문에 여기서 고치지 않으며, Phase 06/07
  계획 시 최우선 보안 수정 후보로 넘긴다. (관련: 이 plan의 threat_model T-05-13은 "판정
  문서"로의 유출만 다뤘고, 앱 자체 로그 파일의 이 URL 로깅 지점은 threat register에 없던
  새 표면이다 — SUMMARY.md의 Threat Flags 섹션 참고.)
- API 모드 제품 경로를 최종 확정하는 결정은 D-04에 따라 이 phase 밖에서 별도로 내린다.

---

## 7. FAIL 시 halt 절차

**해당 없음 — 이번 관측은 `PASS`다.** 재시도는 없었다(2절 참고 — 사다리 자체는 정확히 1회
실행됐고 성공했다). halt 절차를 밟을 필요가 없다.

---

*Phase: 05-api*
*판정일: 2026-08-25*
