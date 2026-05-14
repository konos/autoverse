import { useEffect, useState } from "react";
import type { ApplyEvent, ApplyPhase, ApplyResult } from "../../shared/types";

interface ApplyExecutionProps {
  onReset: () => void;
}

const PHASE_LABELS: Record<ApplyPhase, string> = {
  idle: "대기 중",
  "fetching-form": "폼 조회 중",
  "form-ready": "폼 준비 완료",
  "waiting-consent": "약관 동의 대기",
  "syncing-time": "시간 동기화 중",
  armed: "발사 준비 완료",
  waiting: "신청 시작 대기 중",
  firing: "POST 발사 중",
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
    case "post-fired": return "firing";
    case "poll-result": return "polling";
    case "completed": return "completed";
    case "apply-error": return "error";
    default: return null;
  }
}

export default function ApplyExecution({ onReset }: ApplyExecutionProps) {
  const [phase, setPhase] = useState<ApplyPhase>("armed");
  const [events, setEvents] = useState<ApplyEvent[]>([]);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    const unsubscribe = window.api.onApplyEvent((event: ApplyEvent) => {
      setEvents((prev) => [...prev, event]);
      const newPhase = phaseFromEvent(event);
      if (newPhase) setPhase(newPhase);
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
      const res = await window.api.apply.execute();
      setResult(res);
      setPhase("completed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "신청 실행에 실패했습니다.");
      setPhase("error");
    } finally {
      setExecuting(false);
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
        {isTerminal && (
          <button className="btn btn-secondary" type="button" onClick={handleReset}>
            처음으로
          </button>
        )}
      </div>
    </section>
  );
}
