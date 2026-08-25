---
phase: "03"
plan: "02"
---

# T02: 5개 서비스 파일 console.* → logService 교체 + IPC log:entry 포워딩 + log:download 핸들러 + preload api.log 네임스페이스 추가

**5개 서비스 파일 console.* → logService 교체 + IPC log:entry 포워딩 + log:download 핸들러 + preload api.log 네임스페이스 추가**

## What Happened

auth-service.ts, apply-engine.ts, timing-service.ts, weverse-api.ts, profile-store.ts의 모든 console.log/error/warn 호출을 logService.info/warn/error()로 교체했다. 각 파일에 `import { logService } from "./log-service"` 추가.

ipc-handlers.ts에 다음을 추가:

- `import { dialog } from "electron"` + `import * as fs from "fs"` + `logService` 임포트
- `forwardLogEntry(entry: LogEntry)` 함수 — log:entry IPC 채널로 전송
- `registerIpcHandlers()`에 `logService.on("log-entry", forwardLogEntry)` 추가
- `ipcMain.handle("log:download", ...)` — dialog.showSaveDialog + fs.promises.copyFile
- `unregisterIpcHandlers()`에 cleanup 추가

preload.ts에 `api.log.onEntry(cb)` / `api.log.download()` 추가.
types.ts IpcApi에 `log: { onEntry, download }` 네임스페이스 추가.

## Verification

1. `grep -rn 'console\.log\|console\.error\|console\.warn' src/main/services/ | grep -v __tests__` → 출력 없음 (0개)
2. `npx tsc --noEmit` → exit 0 (renderer+shared 타입 오류 없음)
3. `npx tsc -p tsconfig.main.json --noEmit` → exit 0 (main 프로세스 타입 오류 없음)
4. `npm run build` → exit 0 (renderer + main 빌드 성공)

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -rn 'console\.log\|console\.error\|console\.warn' src/main/services/ | grep -v __tests__ | wc -l` | 0 | pass — 0개 | 120ms |
| 2 | `npx tsc --noEmit` | 0 | pass | 8500ms |
| 3 | `npx tsc -p tsconfig.main.json --noEmit` | 0 | pass | 7200ms |
| 4 | `npm run build` | 0 | pass | 15000ms |

## Deviations

없음

## Known Issues

없음

## Files Created/Modified

- `src/main/services/auth-service.ts`
- `src/main/services/apply-engine.ts`
- `src/main/services/timing-service.ts`
- `src/main/services/weverse-api.ts`
- `src/main/services/profile-store.ts`
- `src/main/ipc-handlers.ts`
- `src/main/preload.ts`
- `src/shared/types.ts`
