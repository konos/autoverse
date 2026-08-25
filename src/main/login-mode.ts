/**
 * Login mode resolution — decides whether the app should use the pure HTTP
 * API login path (Phase 05) or the existing headless BrowserWindow path.
 *
 * D-01: browser mode is the default. Only an exact `"api"` value (after
 * trim + lowercase) switches to API mode — every other value, including
 * unset, falls back to `"browser"`.
 *
 * This function takes `env` as a parameter (not a global `process.env`
 * read) so Phase 06 can swap the body for a persisted-setting lookup
 * without changing the call sites, and so tests can pass a fake env
 * object without mutating global process state.
 */
export type LoginMode = "api" | "browser";

export const LOGIN_MODE_ENV = "AUTOVERSE_LOGIN_MODE";

export function resolveLoginMode(
  env: NodeJS.ProcessEnv = process.env,
): LoginMode {
  const raw = env[LOGIN_MODE_ENV];
  if (typeof raw === "string" && raw.trim().toLowerCase() === "api") {
    return "api";
  }
  return "browser";
}
