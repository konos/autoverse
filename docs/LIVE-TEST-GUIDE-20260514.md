# Weverse 팬이벤트 라이브 테스트 지침 (2026-05-14)

## 대상 이벤트

| # | 공지 URL | 신청 시간 (KST) | 테스트 역할 |
|---|----------|----------------|------------|
| 1 | https://weverse.io/tws/notice/35863 | 20:30 ~ 20:40 | **본 테스트** (문제 파악) |
| 2 | https://weverse.io/tws/notice/35864 | 20:40 ~ 20:50 | **수정 적용 후 재테스트** |

---

## 타임라인

### 테스트 1 (notice/35863)

| 시각 (KST) | 행동 |
|------------|------|
| **20:00** | 앱 실행, Weverse 로그인 완료, 프로필 저장 확인 |
| **20:10** | 토큰 검증 (`validateToken`) 한번 더 실행 → 로그에서 fanId 확인 |
| **20:14** | `35863` 입력 후 **폼 조회** 시도 — 15분 전이므로 `APPLICATION_001` (아직 신청 기간이 아닙니다) 에러 예상 |
| **20:15** | 폼 오픈 시각 (formOpenAt) → **폼 조회 재시도** |
| **20:15~20:20** | 폼 조회 성공 시: 회차 선택, 약관 동의, 프로필 확인 → **신청 준비** 완료 |
| **20:25** | **신청 실행** 버튼 클릭 (시간 동기화 → 대기 → 20:30에 POST 발사) |
| **20:30:00** | POST 발사 → 폴링 → 결과 확인 |
| **20:31~20:35** | 결과/로그 확인 → 즉시 나에게 보고 |

### 문제 파악 & 수정 (20:31 ~ 20:38)
- 성공/실패 여부와 로그 확인
- 문제가 있으면 원인 파악 후 2번 테스트에 반영

### 테스트 2 (notice/35864)

| 시각 (KST) | 행동 |
|------------|------|
| **20:35** | **처음으로** 버튼 → 엔진 리셋 |
| **20:35** | 공지 `35864` 페이지에서 참여신청 URL 확인 → 앱에 입력 후 **폼 조회** (formOpenAt = ~20:25 이므로 이미 열려있어야 함) |
| **20:35~20:38** | 회차 선택, 약관 동의, 프로필 확인 → **신청 준비** |
| **20:38** | **신청 실행** 클릭 |
| **20:40:00** | POST 발사 → 결과 확인 |

---

## 사전 체크리스트

### 앱 실행 전
- [ ] `npm run dev` 또는 `npm start`로 앱 실행
- [ ] macOS 시스템 시간이 정확한지 확인 (시스템 환경설정 > 날짜 및 시간 > 자동 설정)

### 로그인 (20:00)
- [ ] **Weverse 로그인** 버튼 클릭
- [ ] Weverse 로그인 창에서 계정 로그인 완료
- [ ] 로그인 성공 후 `fanId` 표시 확인
- [ ] `토큰 프리뷰` 표시 확인 (마스킹된 형태)

### 프로필 (20:00~20:05)
- [ ] 전화번호 입력 (형식: `+82-10-XXXX-XXXX` 또는 `010-XXXX-XXXX`)
- [ ] 생년월일 입력 (형식: `YYYY-MM-DD`)
- [ ] **프로필 저장** 클릭
- [ ] 저장 성공 메시지 확인

### 참여신청 URL 확인 (20:10~20:14)
- [ ] 브라우저에서 공지 URL(`https://weverse.io/tws/notice/35863`) 열기
- [ ] 페이지 내 **참여신청** 버튼 링크 확인 (형식: `https://fanevent-v2.weverse.io/events/{eventId}/apply/form`)
- [ ] 해당 링크를 복사 (15분 전이라 페이지가 아직 안 열릴 수 있으나, 링크 자체는 확인 가능할 수 있음)

### 폼 조회 (20:15)
- [ ] 앱에 참여신청 URL 붙여넣기 (예: `https://fanevent-v2.weverse.io/events/abc123/apply/form`)
- [ ] **폼 조회** 클릭
- [ ] 이벤트명, 아티스트, 신청 유형, 신청 시작/종료 시각 표시 확인

---

## 예상 문제 & 확인 포인트

### 1. 참여신청 URL 확인 타이밍
**상황**: 공지 페이지 내 "참여신청" 버튼이 15분 전에 활성화되지 않을 수 있음
**확인**: 공지 페이지를 브라우저에서 열어 참여신청 버튼/링크가 보이는지 확인
**대응**: 
- 버튼이 보이면 → 링크에서 `/events/{eventId}` 추출하여 앱에 입력
- 버튼이 안 보이면 → 15분 전(20:15)에 페이지 새로고침 후 다시 확인
- 참여신청 URL을 앱에 직접 붙여넣기 (앱이 `/events/{id}` 패턴에서 eventId 자동 추출)

### 2. 폼 오픈 타이밍
**상황**: formOpenAt이 정확히 15분 전인지, 아니면 다른 시각인지 불확실
**확인**: 폼 조회 성공 시 로그에서 `formOpenAt`, `startAt` 확인
```
WeverseApi fetchFormSchema period formOpenAt=... startAt=...
```
**대응**: 조기 조회 시 `APPLICATION_001` 에러 → formOpenAt 이후 재시도

### 3. responseType이 available이 아닌 경우
**상황**: 신청 기간 전에는 `responseType`이 다른 값일 수 있음
**확인**: 폼 스키마 검증에서 `responseType이 'available'이 아님` 에러
**대응**: 정확한 시간에 재시도 — formOpenAt 이후에만 available로 변경될 수 있음

### 4. applyToken / applyHost
**상황**: 처음 실제 폼을 가져오는 것이므로 32자 applyToken, https:// applyHost 형식 확인 필요
**확인**: 로그에서 `applyHost=https://...` 확인 (토큰은 마스킹됨)
**대응**: 형식이 다르면 form-parser.ts의 검증 조건 수정 필요

### 5. POST 발사 시각 정밀도
**상황**: 20:30:00 정각에 POST가 도달해야 함
**확인**: 로그에서 아래 항목 확인
```
TimingService synced offsetMs=+XX rttMs=XX
TimingService fireTime=...
ApplyEngine phase=firing
WeverseApi submitApplication status=200
```
**대응**: offsetMs가 비정상적으로 크면 (>2000ms) 네트워크 문제

### 6. 신청 후 폴링 결과
**상황**: POST 200 후 상태가 REQUESTED → COMPLETED로 변하는지
**확인**: 로그에서 `pollStatus result=REQUESTED`, `pollStatus result=COMPLETED` 순서 확인
**대응**:
- `FAILED` / `REJECTED` → 서버 거부, 페이로드 문제 확인
- `DUPLICATED` → 이미 신청됨
- 15초 타임아웃 → REQUESTED 상태로 멈춤 = 서버 처리 지연

### 7. 두 이벤트 연속 처리
**상황**: 테스트 1 완료 → 리셋 → 테스트 2 진행 시 엔진 상태가 깨끗한지
**확인**: 리셋 후 `ApplyEngine phase=idle` 로그 확인
**대응**: 리셋이 안 되면 앱 재시작

---

## 로그 확인 방법

### 실시간 로그 (UI)
- 앱 하단의 **로그 패널** 열기/접기로 확인
- error (빨간색), warn (노란색) 로그에 주의

### 로그 파일 저장
- 로그 패널의 **다운로드** 버튼으로 `.log` 파일 저장
- 또는 직접 경로: `~/Library/Application Support/autoverse/logs/2026-05-14.log`

### 핵심 로그 키워드 (grep 용)
```bash
# 전체 플로우 추적
grep "phase=" ~/Library/Application\ Support/autoverse/logs/2026-05-14.log

# POST 발사 시점
grep "phase=firing" ~/Library/Application\ Support/autoverse/logs/2026-05-14.log

# 최종 결과
grep "RESULT" ~/Library/Application\ Support/autoverse/logs/2026-05-14.log

# 타이밍 정보
grep "TIMING" ~/Library/Application\ Support/autoverse/logs/2026-05-14.log

# 에러만
grep '"level":"error"' ~/Library/Application\ Support/autoverse/logs/2026-05-14.log

# 시간 동기화
grep "synced offset" ~/Library/Application\ Support/autoverse/logs/2026-05-14.log
```

---

## 테스트 후 보고 체크리스트

### 즉시 확인 (각 테스트 완료 직후)
- [ ] 신청 성공/실패 여부
- [ ] UI에 표시된 완료 시각 (밀리초 단위)
- [ ] 전체 소요시간, POST→완료 소요시간
- [ ] 에러가 있었다면 에러 코드와 메시지

### 로그 기반 확인
- [ ] `fetchFormSchema` 응답 정상 여부
- [ ] `applyToken` 길이, `applyHost` 형식
- [ ] 시간 동기화 `offsetMs`, `rttMs` 값
- [ ] POST 발사 시점이 startAt 기준 ±100ms 이내인지
- [ ] 폴링 결과 상태 변화 과정

---

## 비상 대응

| 상황 | 대응 |
|------|------|
| 로그인 토큰 만료 | 로그인 다시 실행 (we2_access_token 재추출) |
| 폼 조회 계속 실패 | 참여신청 URL이 정확한지 확인, eventId가 올바르게 추출되었는지 로그 확인 |
| POST 200인데 폴링 타임아웃 | 서버 처리 지연 가능 → Weverse 앱에서 직접 신청 상태 확인 |
| 앱 크래시 | `npm run dev`로 재실행 → 프로필은 암호화 저장되어 있으므로 로그인만 다시 |
| 네트워크 에러 | Wi-Fi / 유선 연결 확인, VPN 해제 시도 |
