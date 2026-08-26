/**
 * API-mode notice re-display decision (Phase 06, D-10).
 *
 * Pure module — imports nothing from the desktop runtime, same tier as
 * mask.ts / form-parser.ts.
 * Deliberately keeps the version constant and the decision function in the
 * same file: whoever edits the notice copy sees `API_MODE_NOTICE_VERSION`
 * right next to the rule it drives ("bump this to force everyone to
 * re-acknowledge") instead of discovering it in a distant settings module.
 *
 * D-10: the notice only needs to be re-shown when its COPY changes, not on
 * every app launch or every mode switch. Bumping `API_MODE_NOTICE_VERSION`
 * is the entire mechanism — persisted `ackedVersion` values below the new
 * number are treated as stale.
 */

/** Bump this integer whenever the API-mode notice copy changes materially. */
export const API_MODE_NOTICE_VERSION = 1;

/**
 * Decide whether the API-mode notice should be shown again.
 *
 * - `ackedVersion === null` → never acknowledged → show.
 * - `ackedVersion < currentVersion` → copy changed since last ack → show.
 * - `ackedVersion >= currentVersion` → already acknowledged the current (or
 *   a future/rolled-back) version → do not show.
 */
export function shouldShowApiModeNotice(
  ackedVersion: number | null,
  currentVersion: number,
): boolean {
  return ackedVersion === null || ackedVersion < currentVersion;
}
