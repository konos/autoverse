import { maskToken } from "../../shared/mask";
import { logService } from "./log-service";
import type {
  FormSchema,
  ApplyPayload,
  StatusResponse,
} from "../../shared/types";

const FAN_API_BASE = "https://fanevent-v2.weverse.io";
const FETCH_TIMEOUT_MS = 5_000;

function commonHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "X-FEV-APP-SOURCE": "FAN_EVENT",
    Accept: "application/json, text/plain, */*",
  };
}

function timedFetch(
  url: string,
  init: RequestInit,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

export class WeverseApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "WeverseApiError";
  }
}

export class WeverseApi {
  /**
   * GET /api/fan-api/v1/events/{eventId}/application
   * Returns form schema + one-time applyToken + dynamic applyHost.
   * 400 APPLICATION_001 → throws WeverseApiError("APPLICATION_001").
   */
  async fetchFormSchema(eventId: string, token: string): Promise<FormSchema> {
    const url = `${FAN_API_BASE}/api/fan-api/v1/events/${encodeURIComponent(eventId)}/application`;
    logService.info("WeverseApi", `fetchFormSchema eventId=${eventId} token=${maskToken(token)}`);

    let res: Response;
    try {
      res = await timedFetch(url, {
        method: "GET",
        headers: commonHeaders(token),
      });
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? "네트워크 타임아웃"
          : `네트워크 에러: ${String(err)}`;
      logService.error("WeverseApi", `fetchFormSchema error event=${eventId}: ${msg}`);
      throw new WeverseApiError("NETWORK_ERROR", msg);
    }

    if (res.status === 400) {
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      const code =
        body &&
        typeof body === "object" &&
        "code" in body &&
        typeof (body as Record<string, unknown>).code === "string"
          ? String((body as Record<string, unknown>).code)
          : "APPLICATION_001";
      logService.error("WeverseApi", `fetchFormSchema 400 code=${code} event=${eventId}`);
      throw new WeverseApiError(
        code,
        code === "APPLICATION_001"
          ? "아직 신청 기간이 아닙니다"
          : `폼 조회 실패: ${code}`,
        400
      );
    }

    if (res.status === 401) {
      throw new WeverseApiError("UNAUTHORIZED", "토큰이 만료됐습니다. 재로그인이 필요합니다.", 401);
    }

    if (!res.ok) {
      throw new WeverseApiError(
        "HTTP_ERROR",
        `폼 조회 실패: HTTP ${res.status}`,
        res.status
      );
    }

    let schema: FormSchema;
    try {
      schema = (await res.json()) as FormSchema;
    } catch {
      throw new WeverseApiError("PARSE_ERROR", "폼 스키마 JSON 파싱 실패");
    }

    logService.info("WeverseApi", `fetchFormSchema ok event=${eventId} responseType=${schema.responseType} applyHost=${schema.applyHost}`);
    return schema;
  }

  /**
   * POST {applyHost}/apply-api/v1/artists/{artistCode}/events/{eventId}
   * Headers include X-FEV-APPLY-AUTHENTICATION (applyToken). 200 = queued.
   */
  async submitApplication(
    applyHost: string,
    artistCode: string,
    eventId: string,
    token: string,
    applyToken: string,
    payload: ApplyPayload
  ): Promise<void> {
    const url = `${applyHost}/apply-api/v1/artists/${encodeURIComponent(artistCode)}/events/${encodeURIComponent(eventId)}`;
    logService.info("WeverseApi", `submitApplication event=${eventId} artist=${artistCode} token=${maskToken(token)} applyToken=${maskToken(applyToken)}`);

    let res: Response;
    try {
      res = await timedFetch(
        url,
        {
          method: "POST",
          headers: {
            ...commonHeaders(token),
            "X-FEV-APPLY-AUTHENTICATION": applyToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
        10_000
      );
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? "제출 타임아웃"
          : `제출 네트워크 에러: ${String(err)}`;
      logService.error("WeverseApi", `submitApplication error event=${eventId}: ${msg}`);
      throw new WeverseApiError("NETWORK_ERROR", msg);
    }

    if (res.status === 200) {
      logService.info("WeverseApi", `submitApplication status=200 event=${eventId}`);
      return;
    }

    if (res.status === 401) {
      throw new WeverseApiError("UNAUTHORIZED", "제출 시 인증 실패 — 토큰 만료", 401);
    }

    let errBody: string;
    try {
      errBody = await res.text();
    } catch {
      errBody = "";
    }
    logService.error("WeverseApi", `submitApplication failed status=${res.status} event=${eventId} body=${errBody.slice(0, 200)}`);
    throw new WeverseApiError(
      "SUBMIT_FAILED",
      `제출 실패: HTTP ${res.status}`,
      res.status
    );
  }

  /**
   * GET {applyHost}/apply-api/v1/artists/{artistCode}/events/{eventId}/status
   * Returns { status: "REQUESTED" | "COMPLETED" | ... }
   */
  async pollStatus(
    applyHost: string,
    artistCode: string,
    eventId: string,
    token: string
  ): Promise<StatusResponse> {
    const url = `${applyHost}/apply-api/v1/artists/${encodeURIComponent(artistCode)}/events/${encodeURIComponent(eventId)}/status`;

    let res: Response;
    try {
      res = await timedFetch(url, {
        method: "GET",
        headers: commonHeaders(token),
      });
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "AbortError"
          ? "폴링 타임아웃"
          : `폴링 네트워크 에러: ${String(err)}`;
      throw new WeverseApiError("NETWORK_ERROR", msg);
    }

    if (!res.ok) {
      throw new WeverseApiError(
        "POLL_FAILED",
        `상태 조회 실패: HTTP ${res.status}`,
        res.status
      );
    }

    let body: StatusResponse;
    try {
      body = (await res.json()) as StatusResponse;
    } catch {
      throw new WeverseApiError("PARSE_ERROR", "상태 응답 JSON 파싱 실패");
    }

    logService.info("WeverseApi", `pollStatus result=${body.status} event=${eventId}`);
    return body;
  }
}
