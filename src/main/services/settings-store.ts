/**
 * Local, non-sensitive app settings — login mode selection + API-mode notice
 * acknowledgement (Phase 06, R016/R021).
 *
 * Mirrors ProfileStore's file-store shape (class + module singleton,
 * getSettingsPath() helper, fs.existsSync guard) but INVERTS the error
 * policy (D-05): this file holds no secrets, so read failures (missing file,
 * corrupt JSON, unknown enum values) never throw — they log a warning and
 * fall back to defaults. Write failures, by contrast, are NOT swallowed —
 * they propagate to the caller so the renderer can refuse to show a change
 * that never made it to disk (UI-SPEC E1 error, wired up in Task 3).
 *
 * Writes use a tmp-file + renameSync atomic swap (same-directory rename is
 * atomic on POSIX/NTFS) so a reader never observes a half-written file.
 * No fsync() — this is loss-tolerant local UI state, not a durability-
 * critical store (see 06-RESEARCH.md Pattern 2 / 06-01-PLAN.md planner_assumptions).
 */
import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import type { LoginMode, LoginModeSnapshot, NoticeAckSnapshot } from "../../shared/types";
import { resolveLoginMode, isLoginModeLockedByEnv } from "../login-mode";
import { API_MODE_NOTICE_VERSION } from "../../shared/api-mode-notice";
import { logService } from "./log-service";

export const SETTINGS_FILENAME = "settings.json";
export const SETTINGS_SCHEMA_VERSION = 1;
export const DEFAULT_LOGIN_MODE: LoginMode = "browser";

interface SettingsFile {
  schemaVersion: number;
  loginMode: LoginMode;
  apiModeNoticeAckedVersion: number | null;
}

export function getSettingsPath(): string {
  return path.join(app.getPath("userData"), SETTINGS_FILENAME);
}

function defaultSettings(): SettingsFile {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    loginMode: DEFAULT_LOGIN_MODE,
    apiModeNoticeAckedVersion: null,
  };
}

function readSettings(): SettingsFile {
  const filePath = getSettingsPath();

  if (!fs.existsSync(filePath)) {
    return defaultSettings();
  }

  // IN-01: 파일 읽기와 JSON 파싱을 별개 try/catch로 분리한다. 기존 코드는 둘을
  // 한 catch에 묶어 로그가 원인과 무관하게 항상 "파싱 실패"라고 단정했다 — 읽기
  // 자체가 실패한 경우(권한, 손상된 파일시스템 등)도 파싱 실패로 오인시켰다.
  // 두 경우 모두 폴백 동작(defaultSettings())과 로그 레벨(warn)은 바꾸지
  // 않는다 — 이 파일은 비민감 설정이라 "조용히 폴백"이 D-05/06 정책상 유효하다.
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    logService.warn("SettingsStore", `settings.json 읽기 실패 — 기본값(browser) 폴백: ${String(err)}`);
    return defaultSettings();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SettingsFile>;
    return {
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      loginMode: parsed.loginMode === "api" ? "api" : DEFAULT_LOGIN_MODE,
      apiModeNoticeAckedVersion:
        typeof parsed.apiModeNoticeAckedVersion === "number" ? parsed.apiModeNoticeAckedVersion : null,
    };
  } catch (err) {
    logService.warn("SettingsStore", `settings.json 파싱 실패 — 기본값(browser) 폴백: ${String(err)}`);
    return defaultSettings();
  }
}

/**
 * Atomic write: tmp file + renameSync. Unlike reads, write failures are
 * re-thrown to the caller (never swallowed) — Task 3 surfaces this failure
 * in the renderer so the UI never shows a selection that failed to persist.
 */
function writeSettings(next: SettingsFile): void {
  const filePath = getSettingsPath();
  const tmpPath = `${filePath}.tmp`;

  try {
    fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2));
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    logService.error("SettingsStore", `settings.json 쓰기 실패: ${String(err)}`);
    // Never leave a partially-written tmp file behind — a future read must
    // not be able to observe it via any path.
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch (cleanupErr) {
      logService.error("SettingsStore", `임시 파일 정리 실패: ${String(cleanupErr)}`);
    }
    throw err;
  }
}

export class SettingsStore {
  getLoginMode(): LoginMode {
    return readSettings().loginMode;
  }

  /**
   * WR-04: 렌더러가 IPC로 보낸 값을 검증 없이 파일로 흘려보내던 경로를 닫는다.
   * 검증 지점을 IPC 핸들러가 아니라 여기(저장 진입점) 안쪽에 둔 이유 — 핸들러
   * 에만 두면 다른 호출 경로가 생겼을 때 다시 새지만, 저장 진입점에 두면 모든
   * 경로가 한 관문을 지난다. `"api"`도 `"browser"`도 아니면 `writeSettings()`
   * 를 호출하지 않고 throw한다 — `writeSettings()` 의 기존 정책("쓰기 실패는
   * 삼키지 않고 호출자에게 전파한다")과 같은 방향이라, 렌더러는 06이 이미 만든
   * 실패 배너 경로로 이 실패를 보게 된다.
   */
  setLoginMode(mode: LoginMode): void {
    if (mode !== "api" && mode !== "browser") {
      throw new Error(`잘못된 로그인 모드: ${String(mode)}`);
    }
    const current = readSettings();
    writeSettings({ ...current, loginMode: mode });
    logService.info("SettingsStore", `loginMode 저장: ${mode}`);
  }

  /**
   * The single point where env-override priority (D-06) is decided: env
   * wins over the persisted value, and lockedByEnv tells the renderer that
   * the tabs are non-interactive without ever exposing the raw env string.
   */
  getLoginModeSnapshot(env: NodeJS.ProcessEnv = process.env): LoginModeSnapshot {
    const persisted = this.getLoginMode();
    return {
      mode: resolveLoginMode(env, persisted),
      lockedByEnv: isLoginModeLockedByEnv(env),
    };
  }

  /**
   * `currentVersion` is always the shared `API_MODE_NOTICE_VERSION` constant
   * — the single source of truth `shouldShowApiModeNotice()` compares
   * against (D-10).
   */
  getNoticeAck(): NoticeAckSnapshot {
    const current = readSettings();
    return { ackedVersion: current.apiModeNoticeAckedVersion, currentVersion: API_MODE_NOTICE_VERSION };
  }

  /**
   * Partial update — only `apiModeNoticeAckedVersion` changes. `loginMode`
   * (and any other field) is read first and carried through untouched, so
   * acknowledging the notice never clobbers the user's mode selection.
   */
  ackNotice(version: number): void {
    const current = readSettings();
    writeSettings({ ...current, apiModeNoticeAckedVersion: version });
    logService.info("SettingsStore", `notice ack 저장: v${version}`);
  }
}

export const settingsStore = new SettingsStore();
