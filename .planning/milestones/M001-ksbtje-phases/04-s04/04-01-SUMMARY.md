---
phase: "04"
plan: "01"
---

# T01: package.json에 mac/win 빌드 타겟(dmg/nsis) + dist 스크립트 3종 추가, 256x256 PNG 아이콘 생성, .gitignore에 release/ 추가 완료

**package.json에 mac/win 빌드 타겟(dmg/nsis) + dist 스크립트 3종 추가, 256x256 PNG 아이콘 생성, .gitignore에 release/ 추가 완료**

## What Happened

1. package.json build 섹션에 mac(target: dmg, category: utilities), win(target: nsis), nsis(oneClick: false, allowToChangeInstallationDirectory: true), asar: true, icon: build/icon.png 추가. 2. scripts에 dist, dist:mac, dist:win 3종 등록. 3. 순수 Node.js(zlib 내장 모듈)로 256x256 RGB PNG 아이콘을 직접 생성 — Canvas/sharp 등 외부 의존성 없이 PNG 바이너리(IHDR+IDAT+IEND 청크)를 직접 구성하여 build/icon.png에 저장(1.8KB). 4. .gitignore에 release/ 디렉토리 추가. 5. npm run build 실행 → Vite renderer 빌드(34 modules) + tsc main 빌드 모두 exit 0 성공.

## Verification

npm run build exit 0, test -f build/icon.png → EXISTS (256x256 PNG 확인됨), grep dist:mac package.json → OK, grep dist:win package.json → OK, grep '"dmg"' package.json → OK, grep '"nsis"' package.json → OK, grep release/ .gitignore → OK

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm run build` | 0 | pass | 4200ms |
| 2 | `test -f build/icon.png` | 0 | pass | 10ms |
| 3 | `file build/icon.png` | 0 | pass — PNG image data, 256 x 256, 8-bit/color RGB | 15ms |
| 4 | `grep -q 'dist:mac' package.json` | 0 | pass | 5ms |
| 5 | `grep -q 'dist:win' package.json` | 0 | pass | 5ms |
| 6 | `grep -q '"dmg"' package.json` | 0 | pass | 5ms |
| 7 | `grep -q '"nsis"' package.json` | 0 | pass | 5ms |
| 8 | `grep -q 'release/' .gitignore` | 0 | pass | 5ms |

## Deviations

없음 — 계획대로 진행

## Known Issues

None.

## Files Created/Modified

- `package.json`
- `build/icon.png`
- `.gitignore`
