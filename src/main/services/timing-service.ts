import type { TimeSyncResult } from "../../shared/types";
import { maskToken } from "../../shared/mask";
import { logService } from "./log-service";

const FANS_ME_URL =
  "https://fanevent-v2.weverse.io/api/fan-api/v1/fans/me";
const SYNC_TIMEOUT_MS = 5_000;
// Fire no earlier than this margin before startAt (server-corrected)
const GUARD_MARGIN_MS = 50;

/**
 * TimingService — §6 서버 시간 동기화 전략.
 *
 * syncTime()           GET /fans/me의 Date 헤더 + RTT/2로 오프셋 계산
 * calculateFireTime()  POST 발사 시각 = startAt - offsetMs - rttMs/2
 * waitUntilFireTime()  정밀 대기 (setTimeout + busy-wait 혼합)
 * parseServerDate()    RFC 7231 Date 헤더 파싱
 * isTimeGuardPassed()  서버 보정 시간이 startAt - 50ms 이후인지 확인
 */
export class TimingService {
  private readonly fetch: typeof globalThis.fetch;

  constructor(fetchFn: typeof globalThis.fetch = globalThis.fetch) {
    this.fetch = fetchFn;
  }

  /**
   * GET /fans/me 한 번으로 서버-로컬 시간 오프셋과 RTT를 측정한다.
   * Date 헤더 누락/파싱 실패 시 offsetMs=0으로 폴백(crash 없음).
   */
  async syncTime(token: string): Promise<TimeSyncResult> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      SYNC_TIMEOUT_MS,
    );

    const t0 = Date.now();
    let t1: number;
    let dateHeader: string | null = null;

    try {
      const res = await this.fetch(FANS_ME_URL, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      t1 = Date.now();
      dateHeader = res.headers.get("date");
    } finally {
      clearTimeout(timer);
    }

    const rttMs = Math.max(0, t1! - t0);
    const localMidMs = t0 + rttMs / 2;

    if (!dateHeader) {
      logService.warn("TimingService", `Date 헤더 없음 — offsetMs=0 폴백 token=${maskToken(token)}`);
      const now = new Date(localMidMs);
      return { offsetMs: 0, rttMs, serverTime: now, localTime: now };
    }

    let serverTime: Date;
    try {
      serverTime = this.parseServerDate(dateHeader);
    } catch {
      logService.warn("TimingService", `Date 헤더 파싱 실패 "${dateHeader}" — offsetMs=0 폴백`);
      const now = new Date(localMidMs);
      return { offsetMs: 0, rttMs, serverTime: now, localTime: now };
    }

    const serverNowMs = serverTime.getTime();
    const offsetMs = serverNowMs - localMidMs;
    const localTime = new Date(localMidMs);

    logService.info(
      "TimingService",
      `synced offsetMs=${offsetMs >= 0 ? "+" : ""}${Math.round(offsetMs)} rttMs=${rttMs} serverTime=${serverTime.toISOString()}`,
    );

    return { offsetMs, rttMs, serverTime, localTime };
  }

  /**
   * startAt 시각에 POST가 서버에 도달하도록 로컬 발사 시각(ms epoch)을 계산한다.
   * 결과가 startAt - 50ms 이전이면 startAt - 50ms로 클램프.
   */
  calculateFireTime(startAt: Date, syncResult: TimeSyncResult): number {
    const startAtMs = startAt.getTime();
    const { offsetMs, rttMs } = syncResult;

    const raw = startAtMs - offsetMs - rttMs / 2;
    const floor = startAtMs - GUARD_MARGIN_MS;
    const fireTimeMs = Math.max(raw, floor);

    logService.info(
      "TimingService",
      `fireTime=${fireTimeMs} (startAt - offset - rtt/2)` +
        (raw < floor ? " [clamped to startAt-50ms]" : ""),
    );

    return fireTimeMs;
  }

  /**
   * fireTimeMs 까지 정밀 대기한다.
   *  - 잔여 > 50ms → setTimeout으로 블로킹
   *  - 잔여 ≤ 50ms → busy-wait(while + Date.now())으로 정밀 대기
   */
  async waitUntilFireTime(fireTimeMs: number): Promise<void> {
    const remaining = () => fireTimeMs - Date.now();

    const coarseMs = remaining() - 50;
    if (coarseMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, coarseMs));
    }

    // Busy-wait for the last ≤ 50ms
    while (Date.now() < fireTimeMs) {
      /* spin */
    }
  }

  /**
   * RFC 7231 HTTP-date 파싱 (e.g. "Mon, 12 May 2026 12:00:00 GMT").
   * 파싱 실패 시 Error throw — 호출자에서 폴백 처리.
   */
  parseServerDate(dateHeader: string): Date {
    const d = new Date(dateHeader);
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid HTTP Date: "${dateHeader}"`);
    }
    return d;
  }

  /**
   * 보정된 현재 서버 시간이 startAt - 50ms 이후인지 확인.
   * false 반환 시 POST를 차단해야 한다.
   */
  isTimeGuardPassed(startAt: Date, syncResult: TimeSyncResult): boolean {
    const serverNow = Date.now() + syncResult.offsetMs;
    const threshold = startAt.getTime() - GUARD_MARGIN_MS;
    const passed = serverNow >= threshold;

    logService.info(
      "TimingService",
      `timeGuard ${passed ? "PASSED" : "BLOCKED"} serverNow=${new Date(serverNow).toISOString()} threshold=${new Date(threshold).toISOString()}`,
    );

    return passed;
  }
}
