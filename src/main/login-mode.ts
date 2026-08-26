/**
 * Login mode resolution — decides whether the app should use the pure HTTP
 * API login path (Phase 05) or the existing headless BrowserWindow path.
 *
 * D-01: browser mode is the default. Only an exact `"api"` value (after
 * trim + lowercase) switches to API mode — every other value, including
 * unset, falls back to `"browser"`.
 *
 * Phase 06: `resolveLoginMode()` now accepts an optional second parameter,
 * `persistedMode` — the value the user chose and `SettingsStore` persisted
 * to `settings.json`. Priority is: env override (`AUTOVERSE_LOGIN_MODE`,
 * dev/QA only) > persisted user selection > `"browser"` default (D-06).
 * `isLoginModeLockedByEnv()` reports whether the env override is active,
 * without exposing its raw string value, so the renderer can show a lock
 * badge while never leaking the env content (T-06-03).
 */
import type { LoginMode } from "../shared/types";

export type { LoginMode };

export const LOGIN_MODE_ENV = "AUTOVERSE_LOGIN_MODE";

export function resolveLoginMode(
  env: NodeJS.ProcessEnv = process.env,
  persistedMode?: LoginMode,
): LoginMode {
  const raw = env[LOGIN_MODE_ENV];
  // A non-empty env value is a full override — it wins even when it
  // explicitly says "browser" while the user persisted "api" (D-06: env
  // is a dev/QA override, not merely an "api" trigger).
  if (typeof raw === "string" && raw.trim().length > 0) {
    return raw.trim().toLowerCase() === "api" ? "api" : "browser";
  }
  if (persistedMode === "api") {
    return "api";
  }
  return "browser";
}

/** True whenever AUTOVERSE_LOGIN_MODE has any non-empty value — including typos. */
export function isLoginModeLockedByEnv(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = env[LOGIN_MODE_ENV];
  return typeof raw === "string" && raw.trim().length > 0;
}
