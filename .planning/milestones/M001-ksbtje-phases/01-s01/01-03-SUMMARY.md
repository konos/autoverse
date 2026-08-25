---
phase: "01"
plan: "03"
---

# T03: ProfileStore 클래스(safeStorage 파일 기반 암호화 저장/불러오기) + profile IPC 핸들러(save/get/clear) + preload API 구현 — 타입 체크·단위 테스트 20개 통과

**ProfileStore 클래스(safeStorage 파일 기반 암호화 저장/불러오기) + profile IPC 핸들러(save/get/clear) + preload API 구현 — 타입 체크·단위 테스트 20개 통과**

## What Happened

T03에서는 Electron safeStorage API를 사용하여 프로필을 OS 수준 암호화로 영구 저장하는 ProfileStore 클래스를 구현했다.

**주요 구현 내용:**

1. `src/main/services/profile-store.ts` — ProfileStore 클래스 신규 생성
   - `saveProfile()`: safeStorage.isEncryptionAvailable() 확인 → safeStorage.encryptString() → app.getPath('userData')/profile.enc 파일에 Buffer 저장. 암호화 비활성화 시 평문 저장 거부(throw).
   - `getProfile()`: profile.enc 읽기 → safeStorage.decryptString() → JSON.parse → Profile 반환. 파일 없으면 null. 복호화/파싱 실패 시 파일 삭제 후 throw.
   - `clearProfile()`: profile.enc 파일 삭제.
   - 로그에 전화번호/생년월일 마스킹 적용(maskPhone, maskBirthDate 사용).

2. `src/main/ipc-handlers.ts` — 기존 인메모리 임시 저장 방식 제거, ProfileStore 사용으로 교체
   - profile:save, profile:get, profile:clear 핸들러로 정리 (기존 profile:load → profile:get, profile:clear 신규 추가)
   - safeStorage 직접 임포트 제거, profileStore 싱글턴 사용

3. `src/main/preload.ts` — profile.load → profile.get 변경, profile.clear 추가

4. `src/shared/types.ts` — IpcApi.profile 인터페이스: load() → get(), clear() 추가

5. `src/main/services/__tests__/profile-store.test.ts` — 20개 단위 테스트:
   - 라운드트립(save/get), null 반환(파일 없음), clearProfile(파일 삭제), safeStorage 비활성화 시 throw, 복호화 실패 → 파일 삭제 + throw, JSON 파싱 실패 → 파일 삭제 + throw, 반복 저장(덮어쓰기), 최소 프로필(fanId만)

**편차 사항:**

- 기존 ipc-handlers.ts에 profile:save/profile:load가 인메모리 방식으로 이미 구현되어 있었음. profile:load를 profile:get으로 이름을 변경하여 태스크 계획과 일치시키고 ProfileStore로 교체함.

## Verification

1. `./node_modules/.bin/tsc --noEmit` — 전체 타입 체크 통과 (exit 0)
2. `./node_modules/.bin/tsc -p tsconfig.main.json --noEmit` — main 프로세스 타입 체크 통과 (exit 0)
3. ProfileStore 단위 테스트 20개 통과 (compile → node 실행):
   - 라운드트립, null 반환, clearProfile, safeStorage 비활성화, 복호화 실패, JSON 파싱 실패, 반복 저장, 최소 프로필
4. 기존 mask.test.ts 전체 통과 (회귀 없음)

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `./node_modules/.bin/tsc --noEmit` | 0 | pass | 4200ms |
| 2 | `./node_modules/.bin/tsc -p tsconfig.main.json --noEmit` | 0 | pass | 3800ms |
| 3 | `node /tmp/profile-store-test-build/main/services/__tests__/profile-store.test.js` | 0 | pass — 20/20 tests passed | 120ms |
| 4 | `node /tmp/profile-store-test-build/shared/__tests__/mask.test.js` | 0 | pass — all tests passed | 80ms |

## Deviations

기존 ipc-handlers.ts에 profile:save/profile:load가 인메모리(encryptedProfile 변수) 방식으로 이미 구현되어 있었음. profile:load를 profile:get으로 변경하고 ProfileStore 기반으로 교체함. preload.ts와 types.ts의 인터페이스도 동기화.

## Known Issues

none

## Files Created/Modified

- `src/main/services/profile-store.ts`
- `src/main/services/__tests__/profile-store.test.ts`
- `src/main/ipc-handlers.ts`
- `src/main/preload.ts`
- `src/shared/types.ts`
