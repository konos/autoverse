import { useState } from "react";
import type { FormSchema } from "../../shared/types";

interface EventSetupProps {
  onFormFetched: (schema: FormSchema) => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  } catch {
    return iso;
  }
}

export default function EventSetup({ onFormFetched }: EventSetupProps) {
  const [eventId, setEventId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState<FormSchema | null>(null);

  const extractEventId = (input: string): string => {
    const trimmed = input.trim();
    const eventsMatch = trimmed.match(/\/events\/([^/]+)/);
    if (eventsMatch) return eventsMatch[1];
    return trimmed;
  };

  const handleFetch = async () => {
    const id = extractEventId(eventId);
    if (!id) {
      setError("이벤트 URL 또는 ID를 입력해주세요.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const schema = await window.api.apply.fetchForm(id);
      setFetched(schema);
      onFormFetched(schema);
    } catch (err) {
      setError(err instanceof Error ? err.message : "폼 조회에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const primaryLang = fetched?.primaryLanguage ?? "ko";

  return (
    <section className="card" aria-labelledby="event-setup-heading">
      <h2 id="event-setup-heading" className="card-title">
        이벤트 설정
      </h2>
      <p className="card-description">응모할 팬 이벤트 URL 또는 ID를 입력하세요.</p>

      <div className="form-field">
        <label htmlFor="eventId" className="form-label">
          이벤트 URL 또는 ID
        </label>
        <input
          id="eventId"
          type="text"
          className="form-input"
          placeholder="예: https://fanevent-v2.weverse.io/events/abc123/apply/form 또는 abc123"
          value={eventId}
          onChange={(e) => {
            setEventId(e.target.value);
            setError(null);
          }}
          disabled={loading}
          aria-required="true"
        />
      </div>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      <div className="button-row">
        <button
          className="btn btn-primary"
          onClick={handleFetch}
          disabled={loading || !eventId.trim()}
          aria-busy={loading}
        >
          {loading ? "조회 중..." : "폼 조회"}
        </button>
      </div>

      {fetched && (
        <div className="event-info" style={{ marginTop: "1rem" }}>
          <div className="status-row">
            <span className="status-label">이벤트명</span>
            <span className="status-value">
              {fetched.display.title[primaryLang] ?? fetched.display.title["ko"] ?? fetched.eventPublicId}
            </span>
          </div>
          <div className="status-row">
            <span className="status-label">아티스트</span>
            <span className="status-value">{fetched.artistName}</span>
          </div>
          <div className="status-row">
            <span className="status-label">신청 유형</span>
            <span className="status-value">{fetched.applyType}</span>
          </div>
          <div className="status-row">
            <span className="status-label">신청 시작</span>
            <span className="status-value">{formatDate(fetched.applyPeriod.startAt)}</span>
          </div>
          <div className="status-row">
            <span className="status-label">신청 종료</span>
            <span className="status-value">{formatDate(fetched.applyPeriod.endAt)}</span>
          </div>
        </div>
      )}
    </section>
  );
}
