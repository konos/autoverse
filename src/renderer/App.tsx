import { useEffect, useState } from "react";
import type { AuthStatus, AuthEvent } from "../shared/types";

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ isLoggedIn: false });
  const [events, setEvents] = useState<AuthEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.api.auth.getStatus().then(setAuthStatus);

    const unsubscribe = window.api.onAuthEvent((event) => {
      setEvents((prev) => [event, ...prev].slice(0, 20));
      if (event.type === "login-success" || event.type === "token-validated") {
        window.api.auth.getStatus().then(setAuthStatus);
      } else if (event.type === "token-expired" || event.type === "login-failed") {
        setAuthStatus({ isLoggedIn: false });
      }
    });

    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await window.api.auth.openLogin();
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    setLoading(true);
    try {
      const status = await window.api.auth.validateToken();
      setAuthStatus(status);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 600 }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Weverse Fanevent Apply</h1>

      <section style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem", color: "#555" }}>인증 상태</h2>
        <p>
          상태:{" "}
          <strong style={{ color: authStatus.isLoggedIn ? "green" : "red" }}>
            {authStatus.isLoggedIn ? "로그인됨" : "로그아웃"}
          </strong>
        </p>
        {authStatus.tokenPreview && (
          <p style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "#666" }}>
            토큰: {authStatus.tokenPreview}
          </p>
        )}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
          <button onClick={handleLogin} disabled={loading}>
            Weverse 로그인
          </button>
          <button onClick={handleValidate} disabled={loading || !authStatus.isLoggedIn}>
            토큰 검증
          </button>
        </div>
      </section>

      {events.length > 0 && (
        <section>
          <h2 style={{ fontSize: "1rem", color: "#555" }}>이벤트 로그</h2>
          <ul style={{ listStyle: "none", padding: 0, fontSize: "0.85rem" }}>
            {events.map((e, i) => (
              <li
                key={i}
                style={{
                  padding: "0.25rem 0",
                  borderBottom: "1px solid #eee",
                  color: e.type.includes("failed") || e.type === "token-expired" ? "red" : "#333",
                }}
              >
                <span style={{ color: "#999" }}>
                  {new Date(e.timestamp).toLocaleTimeString()}
                </span>{" "}
                <strong>{e.type}</strong>
                {e.message && ` — ${e.message}`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
