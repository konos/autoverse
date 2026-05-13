import { useEffect, useRef, useState } from "react";
import type { LogEntry } from "../../shared/types";

const MAX_ENTRIES = 500;

export default function LogPanel() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const unsubscribe = window.api.log.onEntry((entry) => {
      setEntries((prev) => {
        const next = [...prev, entry];
        return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
      });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!collapsed) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries, collapsed]);

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadMsg(null);
    try {
      const result = await window.api.log.download();
      setDownloadMsg(result.saved ? `저장됨: ${result.filePath ?? ""}` : "저장 실패");
    } catch {
      setDownloadMsg("다운로드 오류");
    } finally {
      setDownloading(false);
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("ko-KR", { hour12: false });
    } catch {
      return iso;
    }
  };

  return (
    <section className="log-panel card">
      <div className="log-panel-header">
        <span className="card-title" style={{ marginBottom: 0 }}>시스템 로그</span>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            className="btn btn-secondary"
            style={{ padding: "0.2rem 0.6rem", fontSize: "0.75rem" }}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? "펼치기" : "접기"}
          </button>
          <button
            className="btn btn-primary"
            style={{ padding: "0.2rem 0.6rem", fontSize: "0.75rem" }}
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? "저장 중…" : "로그 다운로드"}
          </button>
        </div>
      </div>

      {downloadMsg && (
        <p className="muted" style={{ fontSize: "0.75rem", marginTop: "0.3rem" }}>
          {downloadMsg}
        </p>
      )}

      {!collapsed && (
        <ul className="log-list log-panel-list">
          {entries.length === 0 && (
            <li className="log-item muted">로그 없음</li>
          )}
          {entries.map((entry, i) => (
            <li
              key={i}
              className={`log-item${entry.level === "error" ? " log-error" : entry.level === "warn" ? " log-warn" : ""}`}
            >
              <span className="log-ts">{formatTimestamp(entry.timestamp)}</span>
              {" "}
              <span className="log-level">[{entry.level.toUpperCase()}]</span>
              {" "}
              <span className="log-source">[{entry.source}]</span>
              {" "}
              {entry.message}
            </li>
          ))}
          <li ref={bottomRef} style={{ listStyle: "none" }} />
        </ul>
      )}
    </section>
  );
}
