# Weverse Fanevent 참여 신청 통신 모방 스펙 v1.0

> 본 문서는 Weverse의 팬이벤트(Fanevent) 모듈을 대상으로, 정상 로그인된 사용자가 본인 계정으로 신청 시 발생하는 HTTP 통신을 분석한 결과입니다.
> 작성 기준 사례: **NCT 2026 POP UP "NEO GROUND" NCTzen WISH 회차 팬클럽 참여 신청** (eventPublicId: `66195918a9c0`, 신청 시각 2026-05-11 21:00 KST).
> 본 스펙의 구현 목적은 **본인 단일 계정에서 신청 응답 시간을 단축**하는 것으로 한정합니다. 다계정 동시 신청, 캡차 우회, 동시 다발 요청 등은 Weverse 이용약관 위반이자 다른 팬에 대한 형평성 문제를 일으키므로 구현에 포함하지 않습니다.

---

## 0. TL;DR

1. 사용자가 브라우저로 Weverse에 로그인 → `.weverse.io` 도메인 쿠키 `we2_access_token`(JWT, JS 읽기 가능) 확보.
2. `GET /api/fan-api/v1/events/{eventPublicId}/application` 으로 폼 스키마와 함께 **applyToken(1회용 32자)** 및 **applyHost(샤딩된 신청 전용 도메인)** 획득.
3. `POST {applyHost}/apply-api/v1/artists/{artistCode}/events/{eventPublicId}` 로 신청 페이로드 전송. 응답은 빈 200 OK (큐잉 완료 신호).
4. `GET {applyHost}/apply-api/v1/artists/{artistCode}/events/{eventPublicId}/status` 를 폴링해 `REQUESTED` → `COMPLETED` 전이를 확인하면 성공.

---

## 1. 시스템 토폴로지

| 도메인 | 역할 |
|---|---|
| `weverse.io` | 공지/팬커뮤니티 (UI 진입점, 공지 안에 신청 페이지 링크가 있음) |
| `account.weverse.io` | 위버스 통합 로그인 (사전 브라우저 로그인용) |
| `fanevent-v2.weverse.io` | 팬이벤트 SPA + **조회용** fan-api (`/api/fan-api/v1/...`) |
| `fanevent-v2-apply-XX.weverse.io` | **신청 제출 전용** 호스트. `applyHost` 응답으로 동적으로 받아옴 (예: `fanevent-v2-apply-04`). 하드코딩 금지. |
| `fanevent-v2-gw.weverse.io` | 게이트웨이 도메인 (코드 내 참조 발견, 일부 트래픽 경로) |
| `clog.weverse.io` | 클라이언트 로깅 (모방 불필요) |
| `cdn-v2pstatic.weverse.io` | 정적 자원 |

---

## 2. 인증

### 2.1 위버스 쿠키 (모두 `.weverse.io` 도메인, JS 읽기 가능)

| 쿠키명 | 설명 |
|---|---|
| `we2_access_token` | JWT 액세스 토큰 (관찰 길이 ~457자). 모든 API 호출의 Bearer 토큰. |
| `we2_refresh_token` | 만료 시 갱신용 (갱신 엔드포인트는 `account.weverse.io` 산하 추정, 본 작업에서는 미캡처) |
| `we2_device_id` | UUID v4 (예: `7af9403e-2b8a-4605-b566-267e4a6dcd3d`) |
| `we2_bridge_device_id` | 동일 UUID 값 |
| `we2_service_lang` | 언어 코드 (예: `ko`) |
| `we2_consent` | 쿠키 동의 정보 |

### 2.2 공통 헤더

| 헤더 | 값 | 비고 |
|---|---|---|
| `Authorization` | `Bearer <we2_access_token>` | 모든 fan-api / apply-api 호출에 필수 |
| `X-FEV-APP-SOURCE` | `FAN_EVENT` | 고정값 |
| `Accept` | `application/json, text/plain, */*` | |

### 2.3 신청 제출 전용 추가 헤더

| 헤더 | 값 |
|---|---|
| `X-FEV-APPLY-AUTHENTICATION` | `applyToken` (GET application 응답의 `applyToken` 필드 값을 그대로 사용. 32자 16진수, 이벤트별 1회용) |
| `Content-Type` | `application/json` |

> 코드에는 `X-FEV-APPLY-TOKEN` 헤더 키도 정의돼 있으나, 실제 트래픽에서는 `X-FEV-APPLY-AUTHENTICATION` 만 관찰됨. 다른 이벤트에서 사용될 가능성이 있어 헤더 키만 메모.

### 2.4 토큰 추출 전략 (툴 측)

1. 사용자가 사전에 브라우저(Chrome 등)에서 Weverse에 로그인.
2. 툴은 브라우저 확장/쿠키 export/네이티브 메신저 등으로 `.weverse.io` 쿠키 6종을 읽어옴.
3. JWT는 통상 1~2시간 단위로 만료되므로, **신청 직전(예: T-10분)에 한 번 임의의 인증 호출(`GET /api/fan-api/v1/fans/me`)로 유효성 확인**, 401이면 사용자에게 재로그인 안내.
4. 토큰 자체를 툴이 발급/갱신하려고 시도하지 말 것. 갱신은 브라우저에서 자동으로 수행되도록 위임.

---

## 3. 엔드포인트 카탈로그

### 3.1 사전 조회

#### GET `/api/fan-api/v1/fans/me`
- Host: `fanevent-v2.weverse.io`
- Headers: `Authorization`, `X-FEV-APP-SOURCE`
- 200 Response:
```json
{ "fanId": 6871442 }
```

#### GET `/api/fan-api/v1/fans/official-memberships?artistCode={artistCode}`
- Host: `fanevent-v2.weverse.io`
- 200 Response:
```json
{
  "contents": [
    {
      "membershipDisplayName": "NCTzen WISH MEMBERSHIP",
      "region": "GL",
      "membershipNumber": "NW950319525",
      "firstName": "...",
      "lastName": "...",
      "startedAt": "2026-05-10T15:00:00Z",
      "endedAt": "2027-05-10T14:59:59Z"
    }
  ]
}
```

#### GET `/api/fan-api/v1/fan/me/applications`
- Host: `fanevent-v2.weverse.io`
- 내 모든 신청 내역 조회 (페이징). 신청 전: `{"contents":[]}`.

#### GET `/api/fan-api/v1/fan/me/events/{eventPublicId}/application`
- Host: `fanevent-v2.weverse.io`
- 특정 이벤트에 대한 내 신청 상세 (신청 완료 후 영수증 확인용)
- 신청 전: 400 `{"tag":"fan_u_error_14",...}`

### 3.2 폼 스키마 + 신청 컨텍스트 (가장 중요)

#### GET `/api/fan-api/v1/events/{eventPublicId}/application`
- Host: `fanevent-v2.weverse.io`
- Headers: `Authorization`, `X-FEV-APP-SOURCE`
- 신청 시작 5분 전(`formOpenAt`) 이후 200, 그 이전엔 400 `APPLICATION_001` / `fan_u_error_12` ("아직 신청 기간이 아닙니다").

200 Response 예시(개인정보 마스킹):
```json
{
  "eventPublicId": "66195918a9c0",
  "artistName": "NCT WISH",
  "artistCode": "NCTWISH",
  "officialMembershipResponse": [
    {
      "region": "GL",
      "membershipNumber": "NW...",
      "firstName": "...",
      "lastName": "...",
      "endedAt": "2027-05-10T14:59:59Z",
      "requiresConfirmPurchase": true
    }
  ],
  "languages": ["ko"],
  "primaryLanguage": "ko",
  "applyPeriod": {
    "formOpenAt": "2026-05-11T11:55:00Z",
    "startAt":    "2026-05-11T12:00:00Z",
    "endAt":      "2026-05-11T12:10:00Z"
  },
  "requiresShopPurchaseConsent": false,
  "applyType": "FIFO",
  "display": {
    "headerImageUrl": null,
    "title":       { "ko": "..." },
    "description": { "ko": "..." },
    "material":    { "ko": "..." }
  },
  "formConfiguration": [
    {
      "useName": false,
      "useMiddleName": false,
      "useBirthDate": true,
      "usePhone": true,
      "messengers": null,
      "minAge": 14,
      "questions": []
    }
  ],
  "consents": [
    { "id": 3983, "title": {"ko":"개인정보 수집 이용 동의"},           "body": {"ko":"..."}, "order": 0 },
    { "id": 3984, "title": {"ko":"개인정보 제3자 제공 동의서 ..."},     "body": {"ko":"..."}, "order": 1 }
  ],
  "rewardGroups": [
    {
      "id": 3895,
      "type": "ROUND",
      "title": { "ko": "참여하실 회차를 선택해주세요." },
      "useCheckIn": true,
      "isSelectable": true,
      "maxSelectableCount": 1,
      "order": 0,
      "rewards": [
        { "id": 4116, "type": "ROUND", "title": {"ko":"5월 15일 (금) 12:00 PM ~ 01:00 PM"}, "scheduleStartAt": "2026-05-14T15:00:00Z" }
        /* ... */
      ]
    }
  ],
  "applyToken": "0412780eba2a...(32자)",
  "applyHost":  "https://fanevent-v2-apply-04.weverse.io",
  "responseType": "available"
}
```

**핵심 필드:**

| 필드 | 용도 |
|---|---|
| `applyPeriod.formOpenAt` | 폼이 노출되는 시각 (`startAt` 5분 전 통상) |
| `applyPeriod.startAt` | **POST 호출 가능 시작 시각** (UTC) |
| `applyPeriod.endAt` | 마감 시각 |
| `applyType` | `"FIFO"` = 선착순, `"DRAW"` = 추첨 등 (관찰값은 FIFO만) |
| `formConfiguration[0].usePhone` | 전화번호 입력 필요 여부 |
| `formConfiguration[0].useBirthDate` | 생년월일 입력 필요 여부 |
| `formConfiguration[0].minAge` | 최소 나이 제한 (만 나이) |
| `formConfiguration[0].questions` | 추가 질문 배열 (이번 이벤트는 빈 배열) |
| `consents[].id` | 모든 동의 항목 ID. 신청 시 전부 포함해야 함 |
| `rewardGroups[].type` | `"ROUND"` 회차 선택, 기타 타입은 이벤트마다 다름 |
| `rewardGroups[].isSelectable` | `true`면 사용자 선택 UI 필요 |
| `rewardGroups[].maxSelectableCount` | 선택 가능 개수 |
| `rewardGroups[].rewards[].id` | 회차/선택지 ID |
| `applyToken` | **POST 시 `X-FEV-APPLY-AUTHENTICATION` 헤더에 그대로 사용** (32자 1회용) |
| `applyHost` | **POST 호출 대상 도메인**. 트래픽 분산을 위해 동적으로 받음. 하드코딩 금지. |
| `responseType` | `"available"` = 신청 가능, 그 외 값 시 신청 불가 분기 |

### 3.3 신청 제출 (POST)

#### POST `{applyHost}/apply-api/v1/artists/{artistCode}/events/{eventPublicId}`

- Headers:
```
  Authorization: Bearer <we2_access_token>
  X-FEV-APP-SOURCE: FAN_EVENT
  X-FEV-APPLY-AUTHENTICATION: <applyToken from GET application>
  Content-Type: application/json
  Accept: application/json, text/plain, */*
```

- Request Body (실제 캡처):
```json
{
  "artistCode": "NCTWISH",
  "eventPublicId": "66195918a9c0",
  "application": {
    "birthDate": "1993-08-03",
    "applicantPhoneNumber": {
      "phoneCountryCode": "82",
      "phoneNumber": "01044847010"
    },
    "applicationConsentIds": [3983, 3984],
    "applyRewards": [
      { "rewardGroupId": 3895, "rewardIds": [4116] }
    ],
    "answers": []
  }
}
```

- 200 Response: **빈 바디** (큐잉 완료 신호. 실제 신청 처리는 비동기로 진행되어 `/status`로 확인)

### 3.4 신청 결과 폴링

#### GET `{applyHost}/apply-api/v1/artists/{artistCode}/events/{eventPublicId}/status`

- Headers: `Authorization`, `X-FEV-APP-SOURCE`
- 200 Response:
```json
{ "status": "REQUESTED" }   // 큐에 들어가서 처리 중
{ "status": "COMPLETED" }   // 정상 접수 완료
```
- 다른 상태 후보(미관찰, 추정): `FAILED`, `REJECTED`, `DUPLICATED`, `EXPIRED`. 실제 신청 후 페이지에서 발생하는 케이스를 추가로 누적할 것.

### 3.5 기타 (코드에서 발견, 실호출 미검증)

| 경로 | 추정 용도 |
|---|---|
| `/api/fan-api/v1/events/{id}/application/unmet-conditions` | 신청 자격 미충족 사유 |
| `/api/fan-api/v1/fan/me/events/{id}/application-result` | 추첨식 이벤트 당첨 결과 |
| `/api/fan-api/v1/events/{id}/winners/{fanId}/form` | 당첨자 추가 정보 폼 |
| `/api/fan-api/v1/events/{id}/winning-result` | 전체 당첨 결과 |
| `/api/fan-api/v1/events/{id}/notices` , `/notices/{noticeId}` | 이벤트 공지 |
| `/api/fan-api/v1/authenticate` | 1회성 인증 토큰 발급 (이번 이벤트에서는 미사용) |
| `/api/fan-api/v1/storage/session-key` | 업로드 등에 사용되는 세션 키 |

---

## 4. 에러 응답 포맷

### 포맷 A (도메인 에러)
```json
{ "debugMessage": null, "tag": "fan_u_error_<N>", "code": "<UPPERCASE>", "args": [] }
```

확인된 매핑:
- `fan_u_error_12` ↔ `APPLICATION_001`: 신청 기간 외 / 폼 미오픈
- `fan_u_error_14`: 내 신청 내역 없음 또는 자격 미충족 (추정)
- `fanevent.alert.auth`: 인증 실패 (Authorization 헤더 누락/만료)

`fan_u_error_1` ~ `fan_u_error_30`(중 일부 결번) 범위가 코드에 존재. 의미는 입력별로 누적 식별 필요.

### 포맷 B (스프링 기본)
```json
{ "timestamp": "2026-05-11T09:09:12.066+00:00", "status": 400, "error": "Bad Request", "path": "/fan-api/v1/..." }
```
주로 필수 쿼리/바디 누락 시 발생.

### 상태 코드
- `200`: 정상
- `400`: 입력/시간/조건 오류
- `401`: Authorization 누락/만료

---

## 5. 전체 시퀀스

```
[T-?]    (사전)  사용자 브라우저로 account.weverse.io 로그인
                → .weverse.io 쿠키 we2_access_token 발급

[T-10분]         GET /api/fan-api/v1/fans/me
                  → 토큰 유효성 확인 (401이면 사용자에게 재로그인 안내)

[T-5분, formOpenAt]
                GET /api/fan-api/v1/events/{id}/application
                  → applyToken, applyHost, rewardGroups, consents, applyPeriod 획득
                  → 폼 스키마로 사용자 입력 수집 (전화번호, 생년월일, 회차 등)

[T-30초]         서버 시간 동기화 (응답 Date 헤더로 오프셋 계산)

[T-0, startAt]
                POST {applyHost}/apply-api/v1/artists/{artistCode}/events/{id}
                  Body: 위 §3.3 Request Body
                  → 200 (빈 바디) = 큐잉 성공

[T+0.2s 부터]    GET  {applyHost}/.../status   (0.3~0.5초 간격, 최대 ~10초 폴링)
                  → status: REQUESTED → COMPLETED 면 성공
                  → 그 외 상태 시 사용자에게 에러 표시 (자동 재시도 금지)

[T+?]            GET /api/fan-api/v1/fan/me/events/{id}/application
                  → 신청 영수증 확인
```

---

## 6. 시간 동기화

- 신청 시간 정확도가 선착순 성공률을 좌우. 다음 절차를 권장:
  1. 신청 직전(T-30초 ~ T-10초)에 가벼운 GET 요청을 1회 보내 응답 헤더 `Date`(GMT)를 파싱.
  2. `serverNowMs - localNowMs = offsetMs` 계산.
  3. `sleepUntil(startAt - offsetMs - rttHalf)` 로 단일 POST 호출 트리거.
- KR 리전 CloudFront 엣지(`ICN80-P2`)까지 RTT는 보통 20~80ms. POST 1회만 보낼 것 (연타 금지).

---

## 7. 페이로드 빌더 규칙

| 필드 | 규칙 |
|---|---|
| `application.birthDate` | `YYYY-MM-DD` (하이픈 구분. UI는 `YYYY/MM/DD`이지만 API는 하이픈) |
| `application.applicantPhoneNumber.phoneCountryCode` | `"82"` (한국은 `+82`에서 `+` 제거한 문자열) |
| `application.applicantPhoneNumber.phoneNumber` | 숫자만, 5~13자리, 하이픈 없음 |
| `application.applicationConsentIds` | `consents[].id` **전부** 포함 (배열 순서는 무관해 보이지만 응답 순서 그대로 권장) |
| `application.applyRewards` | 사용자가 선택한 `{ rewardGroupId, rewardIds: [] }` 배열. `maxSelectableCount`만큼만 `rewardIds`에 담을 것 |
| `application.answers` | `formConfiguration[0].questions`가 비면 `[]`. 질문 있으면 `[{ questionId, answer }]` (스키마 확장 시 추가 캡처 필요) |

---

## 8. 의사코드 (Python)

```python
import time
import requests
from datetime import datetime, timezone

API = "https://fanevent-v2.weverse.io"

def get_headers(access_token):
    return {
        "Authorization": f"Bearer {access_token}",
        "X-FEV-APP-SOURCE": "FAN_EVENT",
        "Accept": "application/json, text/plain, */*",
    }

def apply_to_event(access_token: str, event_id: str,
                   birth_date: str, phone_cc: str, phone_no: str,
                   reward_picker):
    h = get_headers(access_token)

    # 1) 토큰 유효성
    r = requests.get(f"{API}/api/fan-api/v1/fans/me", headers=h, timeout=5)
    r.raise_for_status()

    # 2) 폼 스키마
    r = requests.get(f"{API}/api/fan-api/v1/events/{event_id}/application",
                     headers=h, timeout=5)
    if r.status_code == 400:
        raise RuntimeError(f"신청 페이지 미오픈: {r.text}")
    r.raise_for_status()
    schema = r.json()

    apply_host  = schema["applyHost"]
    apply_token = schema["applyToken"]
    artist_code = schema["artistCode"]
    consent_ids = [c["id"] for c in schema["consents"]]
    rewards     = reward_picker(schema["rewardGroups"])   # 사용자 선택 위임
    start_at    = datetime.fromisoformat(schema["applyPeriod"]["startAt"].replace("Z","+00:00"))

    # 3) 서버 시간 동기화
    r = requests.get(f"{API}/api/fan-api/v1/fans/me", headers=h, timeout=5)
    server_now = datetime.strptime(r.headers["Date"], "%a, %d %b %Y %H:%M:%S GMT").replace(tzinfo=timezone.utc)
    offset_s   = (server_now - datetime.now(timezone.utc)).total_seconds()

    # 4) T-0 대기 후 단일 POST
    while True:
        now_server = datetime.now(timezone.utc).timestamp() + offset_s
        if now_server >= start_at.timestamp() - 0.05:
            break
        time.sleep(0.01)

    submit_headers = {
        **h,
        "X-FEV-APPLY-AUTHENTICATION": apply_token,
        "Content-Type": "application/json",
    }
    body = {
        "artistCode": artist_code,
        "eventPublicId": event_id,
        "application": {
            "birthDate": birth_date,
            "applicantPhoneNumber": {
                "phoneCountryCode": phone_cc,
                "phoneNumber": phone_no,
            },
            "applicationConsentIds": consent_ids,
            "applyRewards": rewards,
            "answers": [],
        },
    }
    resp = requests.post(
        f"{apply_host}/apply-api/v1/artists/{artist_code}/events/{event_id}",
        headers=submit_headers, json=body, timeout=10,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"제출 실패: {resp.status_code} {resp.text}")

    # 5) 결과 폴링
    deadline = time.time() + 15
    while time.time() < deadline:
        s = requests.get(
            f"{apply_host}/apply-api/v1/artists/{artist_code}/events/{event_id}/status",
            headers=h, timeout=5,
        ).json()
        if s["status"] == "COMPLETED":
            return s
        if s["status"] not in ("REQUESTED",):
            raise RuntimeError(f"신청 실패 상태: {s}")
        time.sleep(0.3)
    raise TimeoutError("status 폴링 타임아웃")
```

---

## 9. 안전 가드 (구현 필수)

- **시간 가드**: 로컬에서 `startAt - 50ms` 이전에는 POST 절대 금지. 서버가 `formOpenAt` 시점부터 받아주는 경우가 관찰됐기 때문에, 사용자 의도 보호를 위해 클라이언트가 한 번 더 막아야 함.
- **재시도 금지**: POST 200 응답 후 다른 POST 재호출 금지. `/status` 폴링만 수행. 응답이 5초 안에 안 와도 자동 재시도 금지 (사용자 확인 받고 진행).
- **단일 계정 강제**: 멤버십 중복 가입자가 다른 계정으로 재신청 시 모든 명단에서 제외되는 정책이 있음 → 툴은 동일 시점에 1개 계정 토큰만 사용하도록 강제.
- **약관 동의 명시화**: `applicationConsentIds`는 사용자가 명시적으로 약관 동의 후에만 포함하도록 UX 분기. 자동 채움 금지.
- **본인 정보**: `birthDate`, `phoneNumber`는 사용자 입력 또는 사용자 확정값만 사용. 다른 사용자/제3자 정보 자동 채움 금지.
- **로깅 마스킹**: 디버그 로그에 `Authorization`, `applyToken`, 전화번호, 생년월일, 멤버십 번호를 평문 출력 금지.

---

## 10. 다른 이벤트로 일반화 시 고려사항

- **회차 선택이 없는 이벤트**: `rewardGroups`가 비어있거나 `isSelectable: false`일 수 있음. 이 경우 `applyRewards`는 `[]` 또는 자동 매핑된 단일 그룹/리워드. UI도 동적으로 분기.
- **추첨 이벤트**: `applyType: "DRAW"`인 경우 `endAt` 이후 발표. `/fan/me/events/{id}/application-result` 로 결과 조회 (실제 응답 구조 추가 캡처 필요).
- **추가 질문이 있는 이벤트**: `formConfiguration[0].questions`에 질문 배열이 들어오며, `answers` 배열도 그에 맞춰 채워야 함. 질문 타입 enum은 이번 이벤트에서 빈 배열이라 미캡처 — 실제 사례 등장 시 보강.
- **이름/추가 식별정보**: `useName`, `useMiddleName`이 `true`인 이벤트는 `application` 객체 내에 별도 필드가 추가될 가능성. 캡처 필요.
- **applyHost 동적성**: 트래픽 분산을 위해 같은 이벤트라도 다른 호스트(`apply-01`, `apply-02`, …)가 올 수 있음. **항상 GET application 응답에서 받은 값을 사용**.
- **applyToken 1회용성**: 신청 실패 후 재시도 시 토큰을 갱신해야 할 가능성. 최소한 GET application 재호출로 새 토큰 발급 후 다시 POST.

---

## 11. 미확정/추가 캡처 권장 항목

1. POST 응답의 `2xx`/`4xx` 외 케이스 (선착순 마감 시 상태 코드와 바디 형태).
2. `/status`의 실패 케이스 상태값 (`FAILED`/`REJECTED`/`DUPLICATED`/`EXPIRED` 등 실제 값).
3. `applyToken` 재발급 정책 (만료 시간, 재신청 시 동일 토큰 사용 가능 여부).
4. 추첨식(`applyType: DRAW`) 이벤트의 응답 차이.
5. `formConfiguration[0].questions`의 실제 질문 타입 enum.
6. `account.weverse.io` 토큰 갱신 엔드포인트와 흐름.
7. 캡차/리캡차 노출 조건 (코드에 `recaptcha_text` 키워드 존재, 이번 이벤트에서는 노출되지 않음).

---

## 12. 이용약관·정책 준수

- 본 스펙은 **본인 단일 계정에서 정상 신청 흐름을 모방해 응답 시간을 단축**하는 목적에 한정합니다.
- Weverse 이용약관은 자동화 도구·봇·스크래퍼 사용을 금지합니다. 다음 행위는 본 스펙 범위에서 제외하며, 구현·사용해서는 안 됩니다.
  - 다계정/타인 명의 자동 신청
  - 동시 다발 POST, 마감 후 무한 재시도
  - 캡차/리캡차 우회 (자동 풀이, 외부 캡차 풀이 서비스 호출 포함)
  - 동일 이벤트 중복 신청, 다른 멤버십 계정 교차 신청 (NCT 팬클럽 공지의 명단 제외 룰 위반)
  - 토큰/쿠키 외부 유출, 타인 토큰 사용
- 본 도구의 사용으로 발생하는 약관 위반·계정 제재·이벤트 명단 제외 등의 책임은 사용자에게 있습니다.

## 13. 보안·프라이버시 가이드

- **쿠키/토큰 보관**: 로컬 디스크에 평문 저장 금지. 최소한 OS keychain(macOS Keychain, Windows DPAPI, libsecret 등)을 사용.
- **로그 마스킹**: `Authorization`, `applyToken`, 전화번호, 생년월일, 멤버십 번호, 이름은 디버그·에러 로그에서 모두 마스킹.
- **네트워크**: TLS 1.2+ 강제, HSTS 준수. 프록시·MITM 통한 캡처본을 외부로 공유 금지.
- **삭제 정책**: 신청 완료 후 `applyToken`, 임시 캐시는 즉시 폐기. JWT는 만료 시각까지만 메모리에 보관.
- **사용자 동의 UX**: 약관 동의 체크박스를 코드에서 기본값 `true`로 두지 말 것. 사용자가 명시적으로 클릭해야만 `applicationConsentIds`에 ID가 포함되도록.

## 14. 테스트 전략

| 단계 | 방법 |
|---|---|
| 인증 검증 | `GET /api/fan-api/v1/fans/me` 로 200/`fanId` 반환 확인 |
| 스키마 파싱 | `GET /events/{id}/application` 응답을 픽스처화하여 빌더 단위 테스트 (회차 0/1/N, 동의 1/2/N, 질문 유무) |
| 시간 동기화 | 가짜 서버 `Date` 헤더로 ±2초 오프셋 시 정확히 보정되는지 단위 테스트 |
| 페이로드 빌더 | 본 문서 §3.3 예시 바디와 deep-equal 비교 회귀 테스트 |
| 실패 경로 | `formOpenAt` 이전 호출 시 400 `APPLICATION_001` 처리, 401 시 토큰 갱신 안내, 5xx 시 백오프 |
| 종단 테스트 | **실제 신청 1회 기회를 소모하므로 실 서버 종단 테스트는 본 신청 시에만** 수행. 평시에는 fixtures와 sandbox로 충분 |

## 15. 운영 체크리스트 (신청일 당일)

- [ ] T-1시간: 브라우저로 Weverse 로그인 확인, 쿠키 export 정상 동작 확인
- [ ] T-30분: 도구가 토큰 만료까지 충분한 시간을 갖는지 확인 (JWT `exp` 파싱)
- [ ] T-10분: `GET /events/{id}/application` 응답 확인. `responseType: "available"`, `applyHost` 도메인 응답 정상 여부
- [ ] T-5분: 사용자 입력값(전화번호, 생년월일, 회차) 최종 확정. 회차 선택은 본인이 명시적으로
- [ ] T-1분: 시계 동기화 1회 더 수행
- [ ] T-0: 자동 POST. 콘솔에 `applyToken` 평문 출력 금지
- [ ] T+1분 이내: `status: COMPLETED` 확인 → 사용자 알림
- [ ] T+5분 이내: `GET /fan/me/events/{id}/application` 으로 영수증 확인 후 사용자에게 스크린샷 안내

## 16. 변경 이력

| 버전 | 일자 (KST) | 변경 내용 |
|---|---|---|
| 0.9 | 2026-05-11 18:30 | 공지 페이지 분석, 신청 페이지 미오픈 상태에서 fan-api 엔드포인트와 인증 헤더 구조 1차 파악 |
| 1.0 | 2026-05-11 21:00 | 신청 페이지 오픈 후 실제 폼/`GET application` 응답, `POST {applyHost}/apply-api/v1/...` 요청 바디와 `/status` 응답까지 확정 캡처. 본 문서로 통합 |

## 17. 부록 A — fan_u_error 코드 매핑 (확인분)

| tag | code | 의미 |
|---|---|---|
| `fan_u_error_12` | `APPLICATION_001` | 신청 기간 외 / 폼 미오픈 |
| `fan_u_error_14` | (미확정) | 자격 미충족 / 신청 내역 없음 (추정) |
| `fanevent.alert.auth` | — | 인증 실패 (Authorization 누락·만료) |

> `fan_u_error_1` ~ `fan_u_error_30`(일부 결번) 범위가 코드에 존재. 향후 신청 실패 케이스 발생 시 본 표에 누적할 것.

## 18. 부록 B — 캡처 환경 메모

- 캡처 시각: 2026-05-11 KST 18:00~21:00
- 클라이언트: Chrome 147 / macOS / `we2_device_id` UUIDv4
- 서버 응답 시각: `Date: Mon, 11 May 2026 12:00:00 GMT` (KST 21:00:00) — Date 헤더로 시간 동기화 가능 확인
- CDN/엣지: CloudFront `ICN80-P2` (서울 리전)
- SPA 버전: `meta name="version" content="1.0.26"`

---

*이 문서는 본인 계정 정상 신청 흐름의 기술적 모방을 위한 개발용 레퍼런스입니다. Weverse 이용약관 및 각 이벤트 공지를 우선합니다.*