---
phase: "04"
plan: "03"
---

# T03: npm run dist:win 성공 — release/Weverse Fanevent Apply Setup 0.1.0.exe (84MB) NSIS 인스톨러 생성 완료

**npm run dist:win 성공 — release/Weverse Fanevent Apply Setup 0.1.0.exe (84MB) NSIS 인스톨러 생성 완료**

## What Happened

macOS arm64 환경에서 npm run dist:win을 실행하여 Windows arm64용 NSIS 인스톨러를 크로스 컴파일했다. electron-builder v25.1.8이 자동으로 Wine 4.0.1 (macOS용) 및 NSIS 3.0.4.1, winCodeSign 2.6.0 바이너리를 다운로드하여 코드 서명 없이 NSIS 빌드를 완료했다. 빌드 순서: (1) Vite renderer 빌드 → (2) tsc main 빌드 → (3) electron-builder가 electron-v33.4.11-win32-arm64.zip(120MB) 다운로드 → (4) asar 패키징 → (5) NSIS 인스톨러 생성. 코드 서명 인증서가 없어 signing is skipped 메시지가 출력되었으나 빌드는 정상 완료(exit 0). 최종 아티팩트: release/Weverse Fanevent Apply Setup 0.1.0.exe (84MB) + .exe.blockmap(90KB).

## Verification

npm run dist:win 실행 (exit 0 확인), ls release/*.exe로 아티팩트 존재 확인 (84MB), release/ 디렉토리에 macOS .dmg + Windows .exe 양쪽 플랫폼 아티팩트 공존 확인.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm run dist:win 2>&1; echo EXIT_CODE:$?` | 0 | pass — NSIS 인스톨러 빌드 성공 | 52046ms |
| 2 | `ls -lh release/*.exe` | 0 | pass — Weverse Fanevent Apply Setup 0.1.0.exe 84MB 확인 | 50ms |

## Deviations

none — 계획대로 dist:win 성공, Wine 설치 문서화 불필요(electron-builder가 자동 처리)

## Known Issues

코드 서명 인증서 미적용 — Windows에서 설치 시 SmartScreen 경고 발생 가능. 실제 배포 시 Microsoft 코드 서명 인증서 필요. macOS .dmg도 동일하게 공증(notarization) 미적용.

## Files Created/Modified

- `release/Weverse Fanevent Apply Setup 0.1.0.exe`
- `release/Weverse Fanevent Apply Setup 0.1.0.exe.blockmap`
- `release/win-arm64-unpacked/`
