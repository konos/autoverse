---
status: testing
phase: 07-api
source: [07-VERIFICATION.md]
started: 2026-08-28T09:01:33Z
updated: 2026-08-28T09:01:33Z
---

## Current Test

number: 1
name: 만료 임박 토큰으로 arm 해 대기 화면 경고 배너와 재로그인 버튼을 확인한다
expected: |
  대기 화면 카운트다운 아래에 role="alert" 경고와 '다시 로그인' 버튼이 보이고,
  경고가 떠 있는 동안에도 신청 실행 버튼이 계속 눌린다 (D-12).
awaiting: user response

## Tests

### 1. 만료 경고 배너 렌더링 및 조작 비차단 (07-01)
expected: 만료 임박(또는 exp 를 읽을 수 없는) 토큰 상태로 arm 해 대기 화면에 진입하면, 카운트다운 아래에 role="alert" 경고와 '다시 로그인' 버튼이 보이고, 경고가 떠 있는 동안에도 신청 실행 버튼이 계속 눌린다.
why_human: .tsx 렌더러 컴포넌트는 vitest.config.ts 의 include(.test.ts 만)에 잡히지 않아 실제 렌더링은 자동 테스트 대상이 아니다.
result: [pending]

### 2. 저장 자격증명 화면 4시나리오 (07-04)
expected: API 모드로 로그인 → 앱 종료 후 재시작 → ① 이메일 칸이 저장된 주소로 채워져 있고 비밀번호 칸은 비어 있다 ② '저장된 비밀번호로 로그인'으로 재입력 없이 로그인된다 ③ 이메일을 다른 주소로 바꾸면 버튼이 비활성화되고 '다른 계정입니다' 안내가 뜬다 ④ 로그아웃 상태에서도 상태문과 삭제 버튼이 보이고, 삭제하면 함께 사라진다.
why_human: LoginPanel.tsx JSX 렌더링 — 순수 함수 resolveStoredLoginState() 는 자동 테스트로 커버되지만 실제 화면 반영은 수동 확인 대상이다.
result: [pending]

### 3. 대기 중 재로그인 5시나리오 (07-05) — 시나리오 ④가 CR-01 최종 확인
expected: 대기 화면에서 '다시 로그인'을 눌러 ① API 모드에서 비밀번호 재입력 없이 재로그인이 시작된다 ② 브라우저 모드에서 로그인 창으로 재로그인이 시작된다 ③ 재로그인 성공·실패 어느 쪽이든 대기 화면과 카운트다운이 유지되고 처음 화면으로 돌아가지 않는다 ④ **재로그인이 성공하면 경고가 사라지거나 갱신된다** ⑤ 저장된 자격증명이 없는 API 모드에서 '다시 로그인'을 누르면 이유가 화면에 표시된다.
why_human: 대기 화면 인증 이벤트 흐름은 실계정·타이밍 의존적이라 자동화 대상 밖이다. 시나리오 ④는 2026-08-27 검증에서 CR-01 로 실패가 확인됐던 항목이며, 07-06 이 코드·행동 테스트 수준에서 닫았다 — 이 UAT 는 이제 결함 재확인이 아니라 실계정을 통한 최종 확인 절차다.
result: [pending]

### 4. 재로그인 버튼 연속 클릭 잠금 (WR-01, 07-06)
expected: 대기 화면 '다시 로그인' 버튼을 빠르게 두 번 클릭하면 ① 첫 클릭 직후 버튼이 비활성(회색) 상태가 되어 두 번째 클릭이 들어가지 않는다 ② 시도 종료 후(성공·실패 무관) 버튼이 다시 눌리는 상태로 돌아온다 ③ API 모드에서 저장 자격증명 재로그인이 실패하면 그 사유가 로그인 패널에 문구로 표시된다 ④ 경고·버튼 잠금 중에도 신청 실행 버튼은 계속 눌린다 (D-12).
why_human: .tsx 렌더링/실계정 타이밍 의존이라 vitest 대상 밖이며, 07-06 실행 시 수행되지 않았다 (07-06-SUMMARY.md coverage D3).
result: [pending]

### 5. timeout→쿠키 느린 로그인 경로의 자격증명 저장 (WR-02, 07-07)
expected: credentialLogin() 이 25초 timeout 후 쿠키에서 토큰을 뒤늦게 발견하는 느린 경로를 재현(네트워크를 의도적으로 느리게 하거나 "credentialLogin(headless): result=timeout" 뒤의 성공 로그를 확인)한 뒤 앱을 재시작하면, 이메일 프리필과 저장 비밀번호 로그인 버튼이 나타난다. 재현이 어려우면 정상 경로(폴링 성공)로 저장이 여전히 동작하는지만 확인하고 미재현으로 기록한다.
why_human: 헤드리스 BrowserWindow 의 실제 timeout→쿠키 경로는 DOM 테스트 환경이 없어 재현이 어렵고, 07-07 실행 시 수행되지 않았다 (07-07-SUMMARY.md coverage D1).
result: [pending]

### 6. corrupted → available 안내 전환 (WR-03, 07-07)
expected: API 모드에서 credentials.enc 를 의도적으로 손상시킨 뒤 앱을 재시작해 'corrupted' 안내를 띄우고, 안내대로 이메일/비밀번호를 직접 입력해 로그인에 성공하면, 그 안내가 낡은 채로 남지 않고 '이 기기에 …저장되어 있습니다' 상태문 + 삭제 버튼으로 즉시 바뀐다.
why_human: LoginPanel.tsx JSX 렌더링(vitest 대상 밖)이며, 07-07 실행 시 수행되지 않았다 (07-07-SUMMARY.md coverage D2).
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
