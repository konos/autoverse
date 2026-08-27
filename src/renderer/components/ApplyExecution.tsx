import { useEffect, useState, useRef } from "react";
import type { ApplyEvent, ApplyPhase, ApplyResult, ApplyPeriod, VerifyResult } from "../../shared/types";
import type { TokenExpiryState } from "../../shared/token-expiry";
import { describeTokenExpiryNotice } from "./apply-execution-view";

interface ApplyExecutionProps {
  onReset: () => void;
  applyPeriod: ApplyPeriod;
  eventId: string;
  onRelogin: () => void;
}

const PHASE_LABELS: Record<ApplyPhase, string> = {
  idle: "대기 중",
  "fetching-form": "폼 조회 중",
  "form-ready": "폼 준비 완료",
  "waiting-consent": "약관 동의 대기",
  "syncing-time": "시간 동기화 중",
  armed: "제출 준비 완료",
  waiting: "신청 시작 대기 중",
  firing: "POST 제출 중",
  polling: "결과 폴링 중",
  completed: "신청 완료",
  error: "오류 발생",
};

const PHASE_COLORS: Record<ApplyPhase, string> = {
  idle: "var(--color-muted)",
  "fetching-form": "var(--color-warning)",
  "form-ready": "var(--color-success)",
  "waiting-consent": "var(--color-warning)",
  "syncing-time": "var(--color-warning)",
  armed: "var(--color-primary)",
  waiting: "var(--color-warning)",
  firing: "var(--color-warning)",
  polling: "var(--color-warning)",
  completed: "var(--color-success)",
  error: "var(--color-error)",
};

function phaseFromEvent(event: ApplyEvent): ApplyPhase | null {
  switch (event.type) {
    case "form-fetched": return "form-ready";
    case "time-synced": return "syncing-time";
    case "armed": return "armed";
    case "post-submitted": return "firing";
    case "poll-result": return "polling";
    case "completed": return "completed";
    case "apply-error": return "error";
    default: return null;
  }
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatKST(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false });
  } catch {
    return iso;
  }
}

export default function ApplyExecution({ onReset, applyPeriod, eventId, onRelogin }: ApplyExecutionProps) {
  const [phase, setPhase] = useState<ApplyPhase>("armed");
  const [events, setEvents] = useState<ApplyEvent[]>([]);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [expiryState, setExpiryState] = useState<TokenExpiryState>({ status: "safe" });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [earlyMs, setEarlyMs] = useState(0);
  const [recommendedEarlyMs, setRecommendedEarlyMs] = useState<number | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 200);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const startAtMs = new Date(applyPeriod.startAt).getTime();
  const endAtMs = new Date(applyPeriod.endAt).getTime();
  const msUntilStart = startAtMs - now;
  const msUntilEnd = endAtMs - now;

  useEffect(() => {
    const unsubscribe = window.api.onApplyEvent((event: ApplyEvent) => {
      setEvents((prev) => [...prev, event]);
      const newPhase = phaseFromEvent(event);
      if (newPhase) setPhase(newPhase);
      if (event.type === "time-synced" && event.data) {
        const rec = (event.data as { recommendedEarlyMs?: number }).recommendedEarlyMs;
        if (rec != null) setRecommendedEarlyMs(rec);
      }
      if (event.type === "token-expiry-checked" && event.data) {
        // event.data 는 Record<string, unknown> 이므로 좁혀서 TokenExpiryState 로 복원한다.
        const { status, expAt } = event.data as { status?: string; expAt?: number };
        if (status === "warning" && typeof expAt === "number") {
          setExpiryState({ status: "warning", expAt });
        } else if (status === "unknown") {
          setExpiryState({ status: "unknown" });
        } else {
          setExpiryState({ status: "safe" });
        }
      }
      if (event.type === "apply-error" && event.error) {
        setError(`${event.error.code}: ${event.error.message}`);
      }
    });
    return unsubscribe;
  }, []);

  const handleExecute = async () => {
    setExecuting(true);
    setError(null);
    setPhase("waiting");
    try {
      const res = await window.api.apply.execute(earlyMs);
      setResult(res);
      setPhase("completed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "신청 실행에 실패했습니다.");
      setPhase("error");
    } finally {
      setExecuting(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await window.api.apply.verify(eventId);
      setVerifyResult(res);
    } catch {
      setVerifyResult({ verified: false });
    } finally {
      setVerifying(false);
    }
  };

  const handleReset = async () => {
    try {
      await window.api.apply.reset();
    } catch {
      // best-effort reset
    }
    onReset();
  };

  const isTerminal = phase === "completed" || phase === "error";

  return (
    <section className="card" aria-labelledby="apply-exec-heading">
      <h2 id="apply-exec-heading" className="card-title">
        신청 실행
      </h2>

      <div className="status-row">
        <span className="status-label">현재 단계</span>
        <span
          className="status-badge"
          style={{ color: PHASE_COLORS[phase] }}
          aria-live="polite"
        >
          {PHASE_LABELS[phase]}
        </span>
      </div>

      {/* 신청 기간 + 카운트다운 */}
      <div className="countdown-panel" style={{ marginTop: "0.75rem", padding: "0.75rem", background: "var(--color-bg)", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>현재 시각 (KST)</span>
          <span style={{ fontSize: "0.85rem", fontFamily: "'SF Mono', 'Fira Code', monospace", fontWeight: 600 }}>
            {new Date(now).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>신청 시작</span>
          <span style={{ fontSize: "0.8rem" }}>{formatKST(applyPeriod.startAt)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <span style={{ fontSize: "0.78rem", color: "var(--color-muted)" }}>신청 종료</span>
          <span style={{ fontSize: "0.8rem" }}>{formatKST(applyPeriod.endAt)}</span>
        </div>
        <div style={{ textAlign: "center", padding: "0.5rem 0", borderTop: "1px solid var(--color-border)" }}>
          {msUntilStart > 0 ? (
            <>
              <div style={{ fontSize: "0.72rem", color: "var(--color-muted)", marginBottom: "0.2rem" }}>신청 시작까지</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "'SF Mono', 'Fira Code', monospace", color: "var(--color-primary)", letterSpacing: "0.05em" }}>
                {formatCountdown(msUntilStart)}
              </div>
            </>
          ) : msUntilEnd > 0 ? (
            <>
              <div style={{ fontSize: "0.72rem", color: "var(--color-success)", marginBottom: "0.2rem", fontWeight: 600 }}>신청 진행 중</div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "'SF Mono', 'Fira Code', monospace", color: "var(--color-success)", letterSpacing: "0.05em" }}>
                {formatCountdown(msUntilEnd)}
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--color-muted)" }}>남은 시간</div>
            </>
          ) : (
            <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--color-error)" }}>신청 기간 종료</div>
          )}
        </div>
      </div>

      {/* 토큰 만료 사전 경고 배너 (D-15) — 기존 대기 화면 인라인, 새 모달/영역을 만들지
          않는다. 경고가 신청 실행 버튼의 disabled 조건에 관여하지 않는다(D-12). */}
      {(() => {
        const notice = describeTokenExpiryNotice(expiryState);
        if (!notice.visible) return null;
        const color = notice.tone === "warning" ? "var(--color-error)" : "var(--color-warning)";
        return (
          <div
            role="alert"
            style={{
              marginTop: "0.75rem",
              padding: "0.75rem",
              borderRadius: "8px",
              border: `1px solid ${color}`,
              background: notice.tone === "warning" ? "rgba(239,68,68,0.08)" : "rgba(234,179,8,0.08)",
            }}
          >
            <p className="error-message" style={{ color, margin: 0 }}>
              {notice.message}
              {notice.expAt !== undefined && (
                <span style={{ marginLeft: "0.4rem", fontWeight: 600 }}>
                  (만료까지 {formatCountdown(notice.expAt - now)})
                </span>
              )}
            </p>
            {notice.showRelogin && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onRelogin}
                style={{ marginTop: "0.5rem", fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
              >
                다시 로그인
              </button>
            )}
          </div>
        );
      })()}

      {/* 선제출 설정 */}
      {!isTerminal && (
        <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "var(--color-bg)", borderRadius: "8px", border: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <label htmlFor="earlyMs" style={{ fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap" }}>
              선제출 (ms)
            </label>
            <input
              id="earlyMs"
              type="number"
              min={0}
              max={500}
              step={1}
              value={earlyMs}
              onChange={(e) => setEarlyMs(Math.max(0, Math.min(500, Number(e.target.value) || 0)))}
              disabled={executing}
              style={{ width: "80px", padding: "0.3rem 0.5rem", borderRadius: "4px", border: "1px solid var(--color-border)", fontSize: "0.85rem", fontFamily: "'SF Mono', 'Fira Code', monospace", textAlign: "right" }}
            />
            <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>
              {earlyMs === 0 ? "정시 제출" : `서버 시작 ${earlyMs}ms 전 제출`}
            </span>
          </div>
          {recommendedEarlyMs != null && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>
                추천: {recommendedEarlyMs}ms (네트워크 편도 지연)
              </span>
              <button
                type="button"
                onClick={() => setEarlyMs(recommendedEarlyMs)}
                disabled={executing}
                style={{ fontSize: "0.72rem", padding: "0.15rem 0.5rem", borderRadius: "4px", border: "1px solid var(--color-primary)", background: "transparent", color: "var(--color-primary)", cursor: "pointer" }}
              >
                적용
              </button>
            </div>
          )}
          <p style={{ fontSize: "0.7rem", color: "var(--color-muted)", marginTop: "0.4rem", lineHeight: 1.4 }}>
            0ms = 서버 정시에 POST 제출 (네트워크 전파만큼 자연 지연). 값을 입력하면 그만큼 일찍 제출합니다.
          </p>
        </div>
      )}

      {/* 이벤트 로그 */}
      {events.length > 0 && (
        <div className="event-log" style={{ marginTop: "0.75rem" }}>
          <p className="form-label" style={{ marginBottom: "0.25rem" }}>
            진행 로그
          </p>
          <ul className="log-list">
            {events.map((ev, i) => (
              <li key={i} className="log-item">
                <code className="log-type">{ev.type}</code>
                <span className="muted" style={{ marginLeft: "0.4rem", fontSize: "0.75rem" }}>
                  {new Date(ev.timestamp).toLocaleTimeString("ko-KR")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 결과 */}
      {phase === "completed" && result && (
        <div className="success-message" role="status" style={{ marginTop: "0.75rem" }}>
          <p>신청이 완료되었습니다.</p>
          <p style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
            완료 시각: {new Date(result.completedAt).toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 } as Intl.DateTimeFormatOptions)}
          </p>
          {(() => {
            const completedEvent = events.find(e => e.type === "completed");
            if (!completedEvent?.data) return null;
            const { totalElapsedMs, postToCompleteMs } = completedEvent.data as { totalElapsedMs?: number; postToCompleteMs?: number };
            return (
              <p className="muted" style={{ fontSize: "0.78rem", marginTop: "0.25rem" }}>
                {totalElapsedMs != null && `전체 소요: ${totalElapsedMs}ms`}
                {postToCompleteMs != null && ` | POST→완료: ${postToCompleteMs}ms`}
              </p>
            );
          })()}
        </div>
      )}

      {/* 신청 확인 결과 */}
      {verifyResult && (
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            borderRadius: "8px",
            border: `1px solid ${verifyResult.verified ? "var(--color-success)" : "var(--color-error)"}`,
            background: verifyResult.verified ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "1.1rem" }}>{verifyResult.verified ? "✅" : "❌"}</span>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
              {verifyResult.verified ? "서버 확인 완료 — 신청 접수됨" : "서버에서 신청 내역 미확인"}
            </span>
          </div>
          {verifyResult.status && (
            <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", margin: "0.15rem 0" }}>
              서버 상태: <strong>{verifyResult.status}</strong>
            </p>
          )}
          {verifyResult.eventTitle && (
            <p style={{ fontSize: "0.8rem", color: "var(--color-muted)", margin: "0.15rem 0" }}>
              이벤트: {verifyResult.eventTitle}
            </p>
          )}
        </div>
      )}

      {/* 오류 */}
      {error && (
        <p className="error-message" role="alert" style={{ marginTop: "0.75rem" }}>
          오류: {error}
        </p>
      )}

      <div className="button-row">
        {!isTerminal && (
          <button
            className="btn btn-primary"
            onClick={handleExecute}
            disabled={executing}
            aria-busy={executing}
          >
            {executing ? "신청 중..." : "신청 실행"}
          </button>
        )}
        {phase === "completed" && (
          <button
            className="btn btn-primary"
            onClick={handleVerify}
            disabled={verifying}
            aria-busy={verifying}
            style={{ marginRight: "0.5rem" }}
          >
            {verifying ? "확인 중..." : "신청 확인"}
          </button>
        )}
        {isTerminal && (
          <button className="btn btn-secondary" type="button" onClick={handleReset}>
            처음으로
          </button>
        )}
      </div>
    </section>
  );
}
