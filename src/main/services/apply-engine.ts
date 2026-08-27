import { EventEmitter } from "events";
import { WeverseApi, WeverseApiError } from "./weverse-api";
import { TimingService } from "./timing-service";
import { authService } from "./auth-service";
import { profileStore } from "./profile-store";
import { buildApplyPayload } from "../../shared/payload-builder";
import { validateFormSchema } from "../../shared/form-parser";
import { maskToken } from "../../shared/mask";
import { parseJwtExpMs, evaluateTokenExpiry, RELOGIN_HEADROOM_MS } from "../../shared/token-expiry";
import { logService } from "./log-service";
import type {
  FormSchema,
  ApplyEngineState,
  ApplyPhase,
  ApplyResult,
  ApplyEvent,
  TimeSyncResult,
  VerifyResult,
} from "../../shared/types";

const POLL_INTERVAL_MS = 300;
const POLL_TIMEOUT_MS = 15_000;

export class ApplyEngine extends EventEmitter {
  private readonly api: WeverseApi;
  private readonly timing: TimingService;

  // State
  private phase: ApplyPhase = "idle";
  private phaseTimestamps: Partial<Record<ApplyPhase, number>> = {};
  private schema: FormSchema | null = null;
  private syncResult: TimeSyncResult | null = null;
  private selectedRewardIds: number[] = [];
  private selectedConsentIds: number[] = [];
  // Safety guard: only one POST per engine instance
  private postSubmitted = false;

  constructor(
    api: WeverseApi = new WeverseApi(),
    timingService: TimingService = new TimingService(),
  ) {
    super();
    this.api = api;
    this.timing = timingService;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Fetch form schema from Weverse API and validate it.
   * Emits 'form-fetched' on success.
   */
  async fetchForm(eventId: string): Promise<FormSchema> {
    this._setPhase("fetching-form");

    const token = authService.token;
    if (!token) {
      this._emitError("fetch-form", "UNAUTHORIZED", "로그인이 필요합니다");
      throw new WeverseApiError("UNAUTHORIZED", "로그인이 필요합니다");
    }

    let schema: FormSchema;
    try {
      schema = await this.api.fetchFormSchema(eventId, token);
    } catch (err) {
      const e = err instanceof WeverseApiError ? err : new WeverseApiError("NETWORK_ERROR", String(err));
      this._emitError("fetch-form", e.code, e.message, e.statusCode);
      this._setPhase("error");
      throw err;
    }

    const validation = validateFormSchema(schema);
    if (!validation.valid) {
      const msg = `폼 스키마 유효성 오류: ${validation.errors.join("; ")}`;
      this._emitError("fetch-form", "SCHEMA_INVALID", msg);
      this._setPhase("error");
      throw new WeverseApiError("SCHEMA_INVALID", msg);
    }

    this.schema = schema;
    this._setPhase("form-ready");

    this._emitEvent({
      type: "form-fetched",
      timestamp: Date.now(),
      data: {
        eventId,
        artistCode: schema.artistCode,
        startAt: schema.applyPeriod.startAt,
        consentCount: schema.consents.length,
        rewardGroupCount: schema.rewardGroups.length,
      },
    });

    return schema;
  }

  /**
   * Arm the engine with user-confirmed reward + consent selections.
   * consentIds MUST exactly match all schema.consents — no auto-fill.
   * Emits 'armed' on success.
   */
  arm(selectedRewardIds: number[], consentIds: number[]): void {
    if (!this.schema) {
      throw new Error("arm() 호출 전 fetchForm()을 먼저 실행하세요");
    }
    if (this.phase !== "form-ready") {
      throw new Error(`arm() 호출 불가 — 현재 상태: ${this.phase}`);
    }

    // Safety guard: all consents must be explicitly provided
    const required = this.schema.consents.map((c) => c.id).sort((a, b) => a - b);
    const provided = [...consentIds].sort((a, b) => a - b);
    if (required.length !== provided.length || required.some((id, i) => id !== provided[i])) {
      throw new Error(
        `약관 동의 불일치 — 필요: [${required.join(",")}], 제공: [${provided.join(",")}]`,
      );
    }

    this.selectedRewardIds = selectedRewardIds;
    this.selectedConsentIds = consentIds; // user-explicit only, never auto-filled
    this._setPhase("armed");

    this._emitEvent({
      type: "armed",
      timestamp: Date.now(),
      data: {
        rewardIds: selectedRewardIds,
        consentIds,
      },
    });

    // ── D-10: arm 즉시 만료 판정 ────────────────────────────────────────────
    // exp 는 재로그인 전까지 불변이므로 arm 시점에 이미 결론이 난다 — 가장 이른
    // 시점에 경고해 최대 대응 시간을 준다. 예정 시각은 syncTime() 을 새로
    // 호출하지 않고 schema.applyPeriod.startAt 을 그대로 쓴다(D-08, 외부 호출
    // 0건 — syncResult 는 execute() 안에서만 채워지므로 arm() 시점엔 존재하지
    // 않는다). 판정 실패가 arm 자체를 실패시키지 않는다 — 결과가 safe/warning/
    // unknown 어느 쪽이든 항상 이벤트를 발행한다(재판정 시 이전 경고를 지울 수
    // 있어야 하므로 safe 도 발행한다, D-12).
    const plannedSubmitAtMs = new Date(this.schema.applyPeriod.startAt).getTime();
    const expMs = parseJwtExpMs(authService.token);
    const expiryState = evaluateTokenExpiry(expMs, plannedSubmitAtMs, RELOGIN_HEADROOM_MS);

    logService.info(
      "ApplyEngine",
      `token-expiry-checked status=${expiryState.status} plannedSubmitAt=${new Date(plannedSubmitAtMs).toISOString()} headroomMs=${RELOGIN_HEADROOM_MS}`,
    );

    this._emitEvent({
      type: "token-expiry-checked",
      timestamp: Date.now(),
      data: {
        status: expiryState.status,
        ...(expiryState.status === "warning" ? { expAt: expiryState.expAt } : {}),
        plannedSubmitAt: plannedSubmitAtMs,
        headroomMs: RELOGIN_HEADROOM_MS,
      },
    });
  }

  /**
   * Execute the full apply flow:
   * syncTime → calculateSubmitTime → waitUntilSubmitTime → timeGuard → POST → poll
   * Single POST guarantee enforced by postSubmitted flag.
   */
  async execute(earlyMs = 0): Promise<ApplyResult> {
    if (this.phase !== "armed") {
      throw new Error(`execute() 호출 불가 — 현재 상태: ${this.phase}`);
    }
    if (!this.schema) {
      throw new Error("폼 스키마가 없습니다 — fetchForm() 후 arm() 필요");
    }

    const token = authService.token;
    if (!token) {
      this._emitError("execute", "UNAUTHORIZED", "로그인이 필요합니다");
      this._setPhase("error");
      throw new WeverseApiError("UNAUTHORIZED", "로그인이 필요합니다");
    }

    const profile = profileStore.getProfile();
    if (!profile) {
      this._emitError("execute", "NO_PROFILE", "프로필이 없습니다 — 프로필을 먼저 저장하세요");
      this._setPhase("error");
      throw new Error("프로필이 없습니다");
    }

    const schema = this.schema;

    // ── 1. Sync time ─────────────────────────────────────────────────────────
    this._setPhase("syncing-time");
    let syncResult: TimeSyncResult;
    try {
      syncResult = await this.timing.syncTime(token);
    } catch (err) {
      this._emitError("sync-time", "SYNC_FAILED", `시간 동기화 실패: ${String(err)}`);
      this._setPhase("error");
      throw err;
    }

    this.syncResult = syncResult;
    this._emitEvent({
      type: "time-synced",
      timestamp: Date.now(),
      data: {
        offsetMs: syncResult.offsetMs,
        rttMs: syncResult.rttMs,
        recommendedEarlyMs: Math.round(syncResult.rttMs / 2),
        serverTime: syncResult.serverTime.toISOString(),
      },
    });

    // ── 2. Calculate submit time ─────────────────────────────────────────────
    const startAt = new Date(schema.applyPeriod.startAt);
    logService.info("ApplyEngine", `earlyMs=${earlyMs} recommendedEarlyMs=${Math.round(syncResult.rttMs / 2)}`);
    const submitTimeMs = this.timing.calculateSubmitTime(startAt, syncResult, earlyMs);

    this._setPhase("waiting");

    // ── 3. Wait until submit time ─────────────────────────────────────────────
    await this.timing.waitUntilSubmitTime(submitTimeMs);

    // ── D-13: 대기 이후 토큰 재조회 ─────────────────────────────────────────
    // 대기 이전에 캡처한 `token`을 그대로 쓰면, 사용자가 대기 중 만료 경고를
    // 보고 재로그인해도 그 결과가 실제 POST에 반영되지 않는다 — R022 전체가
    // "경고는 뜨지만 아무것도 구하지 못하는" 기능이 된다. 여기서 다시 읽은
    // `freshToken`이 payload 제출/결과 폴링/post-submitted 이벤트의 토큰
    // 프리뷰에 쓰인다. `syncTime(token)` 호출은 실행 시작 시점의 `token`을
    // 그대로 쓴다 — 시간 오프셋은 토큰 신원에 의존하지 않으므로 옮기지 않는다.
    // 회귀를 막는 테스트: apply-engine.test.ts "execute() D-13 대기 이후 토큰
    // 재조회".
    const freshToken = authService.token;
    if (!freshToken) {
      this._emitError("execute", "UNAUTHORIZED", "로그인이 필요합니다");
      this._setPhase("error");
      throw new WeverseApiError("UNAUTHORIZED", "로그인이 필요합니다");
    }

    // ── 4. Time guard check ───────────────────────────────────────────────────
    if (!this.timing.isTimeGuardPassed(startAt, syncResult)) {
      const msg = "시간 가드: startAt - 50ms 이전 POST 차단";
      this._emitError("time-guard", "TIME_GUARD_BLOCKED", msg);
      this._setPhase("error");
      throw new Error(msg);
    }

    // ── 5. Single POST safety guard ───────────────────────────────────────────
    if (this.postSubmitted) {
      const msg = "POST 중복 차단 — 이미 제출됨";
      this._emitError("post-guard", "POST_ALREADY_SUBMITTED", msg);
      this._setPhase("error");
      throw new Error(msg);
    }

    // ── 6. Build payload ──────────────────────────────────────────────────────
    // Map selectedRewardIds to rewardSelections per group
    const rewardSelections = schema.rewardGroups
      .map((g) => ({
        rewardGroupId: g.id,
        rewardIds: g.rewards
          .filter((r) => this.selectedRewardIds.includes(r.id))
          .map((r) => r.id),
      }))
      .filter((s) => s.rewardIds.length > 0);

    let payload;
    try {
      payload = buildApplyPayload({
        schema,
        profile,
        rewardSelections,
        consentIds: this.selectedConsentIds,
      });
    } catch (err) {
      this._emitError("build-payload", "PAYLOAD_ERROR", String(err));
      this._setPhase("error");
      throw err;
    }

    // ── 7. Submit POST (once) ──────────────────────────────────────────────────
    this._setPhase("firing");
    this.postSubmitted = true;

    let serverDate: string | null = null;
    try {
      const submitResult = await this.api.submitApplication(
        schema.applyHost,
        schema.artistCode,
        schema.eventPublicId,
        freshToken,
        schema.applyToken,
        payload,
      );
      serverDate = submitResult.serverDate;
    } catch (err) {
      const e = err instanceof WeverseApiError ? err : new WeverseApiError("SUBMIT_FAILED", String(err));
      this._emitError("post-submitted", e.code, e.message, e.statusCode);
      this._setPhase("error");
      throw err;
    }

    const serverDateIso = serverDate ? new Date(serverDate).toISOString() : "unknown";
    const startAtIso = schema.applyPeriod?.startAt ?? "unknown";
    if (serverDate && schema.applyPeriod?.startAt) {
      const diffMs = new Date(serverDate).getTime() - new Date(schema.applyPeriod.startAt).getTime();
      logService.info("ApplyEngine", `SERVER_TIMING serverDate=${serverDateIso} startAt=${startAtIso} diffMs=${diffMs}`);
    } else {
      logService.info("ApplyEngine", `SERVER_TIMING serverDate=${serverDateIso} startAt=${startAtIso}`);
    }

    this._emitEvent({
      type: "post-submitted",
      timestamp: Date.now(),
      data: {
        eventId: schema.eventPublicId,
        artistCode: schema.artistCode,
        serverDate: serverDateIso,
        tokenPreview: maskToken(freshToken),
      },
    });

    // ── 8. Poll for result ────────────────────────────────────────────────────
    this._setPhase("polling");

    const result = await this._pollStatus(schema, freshToken);

    this._setPhase("completed");

    const executeStartMs = this.phaseTimestamps["syncing-time"] ?? Date.now();
    const totalElapsedMs = Date.now() - executeStartMs;
    const postSubmittedAt = this.phaseTimestamps["firing"];
    const completedAt = result.completedAt;

    logService.info("ApplyEngine", `RESULT status=${result.status} completedAt=${new Date(completedAt).toISOString()} totalElapsedMs=${totalElapsedMs}`);
    if (postSubmittedAt) {
      logService.info("ApplyEngine", `TIMING postSubmittedAt=${new Date(postSubmittedAt).toISOString()} postToCompleteMs=${completedAt - postSubmittedAt}`);
    }

    this._emitEvent({
      type: "completed",
      timestamp: Date.now(),
      data: {
        status: result.status,
        completedAt: new Date(completedAt).toISOString(),
        totalElapsedMs,
        postToCompleteMs: postSubmittedAt ? completedAt - postSubmittedAt : undefined,
      },
    });

    return result;
  }

  getState(): ApplyEngineState {
    return {
      phase: this.phase,
      phaseTimestamps: { ...this.phaseTimestamps },
      postSubmitted: this.postSubmitted,
      hasSchema: this.schema !== null,
      hasSyncResult: this.syncResult !== null,
    };
  }

  /**
   * Verify application status by checking the server-side application list.
   */
  async verifyApplication(eventId: string): Promise<VerifyResult> {
    const token = authService.token;
    if (!token) {
      return { verified: false };
    }

    try {
      const resp = await this.api.fetchMyApplications(token);
      const entry = resp.contents.find((e) => e.eventPublicId === eventId);
      if (!entry) {
        logService.info("ApplyEngine", `verify eventId=${eventId} not found in applications`);
        return { verified: false };
      }

      const title = entry.eventTitle[entry.eventPrimaryLanguage] ?? Object.values(entry.eventTitle)[0] ?? "";
      logService.info("ApplyEngine", `verify eventId=${eventId} status=${entry.status} title=${title}`);

      return {
        verified: entry.status === "APPLIED",
        status: entry.status,
        eventTitle: title,
      };
    } catch (err) {
      logService.error("ApplyEngine", `verify error: ${String(err)}`);
      return { verified: false };
    }
  }

  reset(): void {
    this.phase = "idle";
    this.phaseTimestamps = {};
    this.schema = null;
    this.syncResult = null;
    this.selectedRewardIds = [];
    this.selectedConsentIds = [];
    this.postSubmitted = false;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private _setPhase(phase: ApplyPhase): void {
    this.phase = phase;
    this.phaseTimestamps[phase] = Date.now();
    logService.info("ApplyEngine", `phase=${phase}`);
  }

  private _emitEvent(event: ApplyEvent): void {
    this.emit(event.type, event);
    this.emit("apply-event", event);
  }

  private _emitError(
    phase: string,
    code: string,
    message: string,
    statusCode?: number,
  ): void {
    logService.error("ApplyEngine", `error phase=${phase} code=${code} msg=${message}`);
    const event: ApplyEvent = {
      type: "apply-error",
      timestamp: Date.now(),
      data: { phase },
      error: { code, message, statusCode },
    };
    this._emitEvent(event);
  }

  private async _pollStatus(
    schema: FormSchema,
    token: string,
  ): Promise<ApplyResult> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      let statusResp;
      try {
        statusResp = await this.api.pollStatus(
          schema.applyHost,
          schema.artistCode,
          schema.eventPublicId,
          token,
        );
      } catch (err) {
        const e = err instanceof WeverseApiError ? err : new WeverseApiError("POLL_FAILED", String(err));
        this._emitError("polling", e.code, e.message, e.statusCode);
        this._setPhase("error");
        throw err;
      }

      this._emitEvent({
        type: "poll-result",
        timestamp: Date.now(),
        data: { status: statusResp.status },
      });

      if (statusResp.status === "COMPLETED" || statusResp.status === "PROCESSING") {
        return { status: statusResp.status, completedAt: Date.now() };
      }

      if (statusResp.status !== "REQUESTED") {
        const msg = `신청 실패: ${statusResp.status}`;
        this._emitError("polling", "APPLY_REJECTED", msg);
        this._setPhase("error");
        throw new Error(msg);
      }

      await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    // Timeout
    const msg = `폴링 타임아웃 (${POLL_TIMEOUT_MS / 1000}초 초과)`;
    this._emitError("polling", "POLL_TIMEOUT", msg);
    this._setPhase("error");
    throw new Error(msg);
  }
}

export const applyEngine = new ApplyEngine();
