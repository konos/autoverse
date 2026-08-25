---
status: testing
phase: 05-api
source: [05-VERIFICATION.md]
started: 2026-08-25T10:12:00Z
updated: 2026-08-25T10:12:00Z
---

## Current Test

number: 1
name: ApplyEngine이 사다리로 확보한 account 토큰으로 실제 신청을 수행할 수 있는지 확인
expected: |
  ApplyEngine 의 신청 POST 흐름이, `authService.token` 이 사다리에서 유래한 계정 도메인 토큰
  (관측된 `accountapi.weverse.io` 의 `rt` 쿠키 값)을 담고 있을 때에도 코드 변경 없이 그대로
  성공한다 — ROADMAP Phase 05 Success Criteria 3 의 후반절
  ("ApplyEngine이 이 토큰을 코드 변경 없이 그대로 사용해 신청을 수행할 수 있다") 그대로.
awaiting: user response

## Tests

### 1. ApplyEngine이 사다리로 확보한 account 토큰으로 실제 신청을 수행할 수 있는지 확인

expected: ApplyEngine 의 신청 POST 흐름이 사다리 유래 계정 도메인 토큰으로도 코드 변경 없이 성공한다.
result: [pending]

why_human: `05-SPIKE-RESULT.md` §4 가 스스로 "형태(shape) 수준의 판단이지 실제 배선 테스트는
아니다 — 검증되지 않았다" 고 명시한다. 스파이크는 설계상 읽기 전용이라 `authService.token` 을
덮어쓰지 않았고 신청을 트리거하지도 않았다. 자동 증거는 기존 `apply-engine.test.ts` 회귀
스위트(17/17) 뿐인데, 이는 이 새 토큰 소스를 전혀 행사하지 않으므로 "코드 레벨 회귀 없음"
만 말할 뿐 "ApplyEngine 이 이 토큰을 받아들인다" 를 증명하지 않는다. grep/타입 추론으로는
판정 불가능한 행동적 주장이며, 실제(또는 스테이징) 신청 시도 1회 또는 "shape 수준 근거로
충분하다" 는 명시적 사람 판단이 필요하다. D-04(로그인 방식 최종 결정)로 넘어가는 리스크다.

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
