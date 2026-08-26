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

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
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

  setLoginMode(mode: LoginMode): void {
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
   * Storage/retrieval only in this task — Task 2 wires `currentVersion` to
   * the shared `API_MODE_NOTICE_VERSION` constant and adds the re-notice
   * decision function (`shouldShowApiModeNotice`).
   */
  getNoticeAck(): NoticeAckSnapshot {
    const current = readSettings();
    // TODO(Task 2): replace this placeholder with the shared
    // API_MODE_NOTICE_VERSION constant from src/shared/api-mode-notice.ts.
    const CURRENT_NOTICE_VERSION_PLACEHOLDER = 1;
    return { ackedVersion: current.apiModeNoticeAckedVersion, currentVersion: CURRENT_NOTICE_VERSION_PLACEHOLDER };
  }

  ackNotice(version: number): void {
    const current = readSettings();
    writeSettings({ ...current, apiModeNoticeAckedVersion: version });
    logService.info("SettingsStore", `notice ack 저장: v${version}`);
  }
}

export const settingsStore = new SettingsStore();
