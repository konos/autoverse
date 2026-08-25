---
phase: "02"
plan: "04"
---

# T04: 신청 UI 컴포넌트 3종(EventSetup, ApplyForm, ApplyExecution) + App.tsx apply 흐름 step 통합 — tsc 타입 오류 0, 빌드 성공

**신청 UI 컴포넌트 3종(EventSetup, ApplyForm, ApplyExecution) + App.tsx apply 흐름 step 통합 — tsc 타입 오류 0, 빌드 성공**

## What Happened

T01~T03에서 구축한 main 프로세스 기반(ApplyEngine, TimingService, WeverseApi, IPC 5채널) 위에 renderer 측 React 컴포넌트 4개를 구현하여 신청 전체 흐름을 UI로 제어한다.

**EventSetup.tsx** — 이벤트 ID 텍스트 입력 + '폼 조회' 버튼. `window.api.apply.fetchForm(id)` 호출 후 이벤트명·아티스트·신청 유형·신청 시작/종료 시각을 카드 하단에 표시. 조회 성공 시 `onFormFetched(schema)` 콜백으로 schema를 App으로 전달하고 `apply-form` step으로 전환.

**ApplyForm.tsx** — FormSchema 기반 동적 UI. 핵심 세 영역:

1. 회차 선택: `rewardGroups.filter(g => g.isSelectable)` 로 선택 가능 그룹만 렌더링, 각 그룹의 rewards를 라디오 버튼으로 표시.
2. 약관 동의: `schema.consents` 배열을 체크박스+펼침/접힘 버튼으로 렌더링. **초기값 모두 false** (R009 준수 — `Object.fromEntries(schema.consents.map(c => [c.id, false]))`). 전문 보기 토글 지원.
3. 프로필 확인: `window.api.profile.get()` 으로 로드된 phone/birthDate를 `maskPhone`/`maskBirthDate`로 마스킹하여 표시. '이 정보로 신청합니다' 버튼 클릭 시 profileConfirmed=true.

'신청 준비' 버튼은 `allConsentsChecked && allGroupsSelected && profileConfirmed` 모두 충족 시에만 활성화. `window.api.apply.arm(rewardIds, consentIds)` 호출 후 `onArmed()` 콜백 → `apply-execution` step.

**ApplyExecution.tsx** — `window.api.onApplyEvent` 구독으로 `form-fetched → time-synced → armed → post-fired → poll-result → completed/apply-error` 이벤트를 실시간으로 단계 label 업데이트. '신청 실행' 버튼 클릭 시 `window.api.apply.execute()` 호출. COMPLETED → 성공 메시지+완료 시각, error → 에러 메시지 표시 (재시도 안내 없음). 완료/오류 후 '처음으로' 버튼으로 `apply.reset()` 호출 후 `event-setup` step으로 복귀.

**App.tsx** — `AppStep` 타입에 `'event-setup' | 'apply-form' | 'apply-execution'` 추가. `handleProfileSaved` 콜백이 이제 `setStep('event-setup')`으로 전환. `formSchema` state로 schema를 단계 간 전달. 각 step에 맞는 컴포넌트 조건부 렌더링.

**styles.css** — 새 컴포넌트에서 사용하는 CSS 클래스 추가: `.btn-secondary`, `.btn-success`, `.btn-text`, `.form-section`, `.reward-options`, `.radio-label`, `.checkbox-label`, `.consent-item`, `.consent-header`, `.consent-body`, `.event-log`, `.log-list`, `.log-item`, `.log-type`.

## Verification

1. `npx tsc --noEmit` — exit 0, 타입 오류 없음 (renderer + shared + main 전체).
2. `npm run build` — exit 0, vite renderer 빌드 33 modules + tsc main 빌드 성공.
3. 코드 리뷰: `ApplyForm.tsx:26` — `Object.fromEntries(schema.consents.map((c) => [c.id, false]))` 로 초기값 모두 false, defaultChecked 미사용 확인 (grep 결과 없음).
4. 마스킹: maskPhone/maskBirthDate를 ../../shared/mask에서 import하여 프로필 표시에 적용 확인.
5. '신청 준비' 버튼 비활성 조건: `!canArm` (allConsentsChecked && allGroupsSelected && profileConfirmed 모두 true일 때만 활성화) 코드 확인.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | pass | 8200ms |
| 2 | `npm run build` | 0 | pass | 4300ms |
| 3 | `grep -n 'defaultChecked|checked.*true' src/renderer/components/ApplyForm.tsx` | 1 | pass — no auto-checked consent | 50ms |

## Deviations

없음

## Known Issues

없음 — S03에서 로그 패널(구조화 이벤트 표시) 및 실제 Electron 앱 통합 테스트 예정

## Files Created/Modified

- `src/renderer/components/EventSetup.tsx`
- `src/renderer/components/ApplyForm.tsx`
- `src/renderer/components/ApplyExecution.tsx`
- `src/renderer/App.tsx`
- `src/renderer/styles.css`
