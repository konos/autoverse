import { useEffect, useMemo, useRef, useState } from "react";
import type { AuthStatus, AuthEvent, FormSchema, LoginMode } from "../shared/types";
import LoginPanel from "./components/LoginPanel";
import ProfileForm from "./components/ProfileForm";
import EventSetup from "./components/EventSetup";
import ApplyForm from "./components/ApplyForm";
import ApplyExecution from "./components/ApplyExecution";
import LogPanel from "./components/LogPanel";
import { createLoginModeActions as makeLoginModeActions } from "./login-mode-actions";
import { decideAuthEventNavigation, type AppStep } from "./auth-event-navigation";
import "./styles.css";

export default function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ isLoggedIn: false });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [step, setStep] = useState<AppStep>("login");
  const [formSchema, setFormSchema] = useState<FormSchema | null>(null);
  const [loginMode, setLoginModeState] = useState<LoginMode>("browser");
  const [lockedByEnv, setLockedByEnv] = useState(false);
  // currentVersion starts at API_MODE_NOTICE_VERSION's known floor (1) and is
  // corrected from main on mount below — main is the source of truth so a
  // version bump is never missed even if this default drifts.
  const [noticeAck, setNoticeAck] = useState<{ ackedVersion: number | null; currentVersion: number }>({
    ackedVersion: null,
    currentVersion: 1,
  });

  // decideAuthEventNavigation() 은 "현재" step 을 알아야 apply-execution 대기 중
  // 인증 이벤트가 armed 상태를 지키는지 판단할 수 있다. 아래 onAuthEvent 구독은
  // 마운트 시 한 번만 등록되는 useEffect([]) 안에 있어 그 클로저가 잡는 `step`
  // 값은 초기값("login")에 영구히 고정된다 — ref 로 최신값을 별도 추적하지
  // 않으면 이 판단 자체가 항상 "login" 단계로 잘못 평가되어 Pitfall 3 를 실제로는
  // 막지 못한다(이 태스크가 처음 만드는 필요 — 이전에는 이 핸들러가 step 을
  // 읽지 않았으므로 문제가 없었다).
  const stepRef = useRef<AppStep>(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    window.api.auth.getStatus().then((s) => {
      setAuthStatus(s);
      if (s.isLoggedIn) setStep("profile");
    });

    window.api.settings.getLoginMode().then((snapshot) => {
      setLoginModeState(snapshot.mode);
      setLockedByEnv(snapshot.lockedByEnv);
    });

    window.api.settings.getNoticeAck().then((snapshot) => {
      setNoticeAck(snapshot);
    });

    const unsubscribe = window.api.onAuthEvent((event: AuthEvent) => {
      // 상태 갱신(setAuthStatus/setLoginError)은 이벤트 종류별로 기존 그대로
      // 유지한다 — 대기 화면에서 token-expired 로 isLoggedIn 이 false 가 되면
      // LoginPanel 의 로그인 폼이 다시 나타나는 것은 의도된 결과다(사용자에게
      // 재로그인 경로가 하나 더 열린다). 네비게이션(setStep/setFormSchema)만
      // decideAuthEventNavigation() 의 반환값 분기 안에서 일어난다 — "stay" 면
      // 두 setter 모두 호출되지 않아 armed 상태와 formSchema 가 보존된다
      // (Pitfall 3).
      const decision = decideAuthEventNavigation(event.type, stepRef.current);

      if (event.type === "login-success") {
        setLoginError(null);
        window.api.auth.getStatus().then((s) => {
          setAuthStatus(s);
          if (decision.action === "to-profile" && s.fanId !== undefined) {
            setStep("profile");
          }
        });
      } else if (event.type === "token-validated") {
        window.api.auth.getStatus().then((s) => {
          setAuthStatus(s);
          if (decision.action === "to-profile" && s.fanId !== undefined) {
            setStep("profile");
          }
          setLoginError(null);
        });
      } else if (event.type === "login-failed") {
        setAuthStatus({ isLoggedIn: false });
        setLoginError(event.message ?? "로그인에 실패했습니다.");
        if (decision.action === "to-login") {
          setStep("login");
        }
      } else if (event.type === "token-expired") {
        setAuthStatus({ isLoggedIn: false });
        setLoginError("토큰이 만료되었습니다. 다시 로그인해주세요.");
        if (decision.action === "to-login") {
          setStep("login");
        }
      } else if (event.type === "cookie-extraction-failed") {
        setAuthStatus({ isLoggedIn: false });
        setLoginError(event.message ?? "쿠키 추출에 실패했습니다.");
        if (decision.action === "to-login") {
          setStep("login");
        }
      } else if (event.type === "logged-out") {
        setAuthStatus({ isLoggedIn: false });
        setLoginError(null);
        if (decision.action === "to-login-and-clear-schema") {
          setStep("login");
          setFormSchema(null);
        }
      }
    });

    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      await window.api.auth.openLogin();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "로그인 요청 중 오류가 발생했습니다.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async (clearCredentials: boolean) => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      await window.api.auth.logout(clearCredentials);
      setAuthStatus({ isLoggedIn: false });
      setStep("login");
      setFormSchema(null);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "로그아웃 중 오류가 발생했습니다.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleValidateToken = async () => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const s = await window.api.auth.validateToken();
      setAuthStatus(s);
      if (!s.isLoggedIn) {
        setStep("login");
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "토큰 검증 중 오류가 발생했습니다.");
    } finally {
      setLoginLoading(false);
    }
  };

  // D-07: mode changes never touch authStatus/step — the current session
  // (login state, token, fanId) survives a login-mode change untouched.
  // Local state updates only AFTER the IPC write succeeds (never
  // optimistically before), so a failed write leaves the previously-
  // selected tab visibly active — there is no separate rollback step
  // because the state was never advanced in the first place (UI-SPEC E1
  // error). The login-mode-actions factory owns the actual save/failure
  // decisions now (06-08 gap closure, CR-01) — this component only wires
  // its own state setters as deps and never decides which failure
  // contract to use for which caller.
  const loginModeActions = useMemo(
    () =>
      makeLoginModeActions({
        persistLoginMode: (mode) => window.api.settings.setLoginMode(mode),
        persistNoticeAck: (version) => window.api.settings.ackNotice(version),
        onModeApplied: (mode) => setLoginModeState(mode),
        onNoticeAcked: (version) => setNoticeAck((prev) => ({ ...prev, ackedVersion: version })),
        onBannerError: (message) => setLoginError(message),
        onDiagnostic: (err) => console.error("로그인 방식 설정 저장 실패:", err),
      }),
    // React setState 함수와 window.api 는 안정적이므로 의존성 배열을 비운다.
    [],
  );

  const handleProfileSaved = () => {
    setStep("event-setup");
  };

  const handleFormFetched = (schema: FormSchema) => {
    setFormSchema(schema);
    setStep("apply-form");
  };

  const handleArmed = () => {
    setStep("apply-execution");
  };

  const handleReset = () => {
    setFormSchema(null);
    setStep("event-setup");
  };

  // 대기 화면(ApplyExecution) 경고 배너의 "다시 로그인" 진입점(D-15, Pitfall 2).
  // 모드에 맞는 실제 재로그인을 시작하고, 성공·실패 무관하게 마지막에
  // checkTokenExpiry() 로 D-10 재판정을 트리거한다. step 은 이 함수 어디에서도
  // 바꾸지 않는다 — apply-execution 유지는 위 onAuthEvent 의
  // decideAuthEventNavigation() "stay" 판정이 보장한다.
  const handleReloginFromWaiting = async () => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      if (loginMode === "browser") {
        await window.api.auth.openLogin();
      } else {
        const snapshot = await window.api.auth.getStoredCredentials();
        switch (snapshot.state) {
          case "available":
            await window.api.auth.credentialLoginStored(snapshot.email);
            break;
          case "none":
            setLoginError("저장된 로그인 정보가 없습니다 — 비밀번호를 입력해 로그인해주세요.");
            break;
          case "corrupted":
            setLoginError("저장된 로그인 정보를 읽지 못해 초기화했습니다 — 다시 입력해주세요.");
            break;
          case "unavailable":
            setLoginError("이 환경에서는 저장된 정보를 사용할 수 없습니다 — 비밀번호를 입력해주세요.");
            break;
        }
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "재로그인 중 오류가 발생했습니다.");
    } finally {
      try {
        // 재로그인 시도가 끝나면 성공·실패 무관하게 새 토큰으로 만료를
        // 재판정한다(D-10). 이 호출 자체의 실패가 재로그인 흐름을 막지
        // 않도록 별도로 감싼다.
        await window.api.apply.checkTokenExpiry();
      } catch {
        // best-effort — 재판정 실패를 사용자에게 별도로 알리지 않는다.
      }
      setLoginLoading(false);
    }
  };

  return (
    <main className="app">
      <h1 className="app-title">Weverse Fanevent Apply</h1>

      <LoginPanel
        status={authStatus}
        loading={loginLoading}
        error={loginError}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onValidateToken={handleValidateToken}
        loginMode={loginMode}
        lockedByEnv={lockedByEnv}
        onSetLoginMode={loginModeActions.setLoginMode}
        noticeAck={noticeAck}
        onAcknowledgeNotice={loginModeActions.acknowledgeApiModeNotice}
      />

      {step === "profile" && authStatus.isLoggedIn && authStatus.fanId !== undefined && (
        <ProfileForm fanId={authStatus.fanId} onSaved={handleProfileSaved} />
      )}

      {step === "event-setup" && authStatus.isLoggedIn && (
        <EventSetup onFormFetched={handleFormFetched} />
      )}

      {step === "apply-form" && formSchema !== null && authStatus.fanId !== undefined && (
        <ApplyForm
          schema={formSchema}
          fanId={authStatus.fanId}
          onArmed={handleArmed}
        />
      )}

      {step === "apply-execution" && formSchema && (
        <ApplyExecution
          onReset={handleReset}
          applyPeriod={formSchema.applyPeriod}
          eventId={formSchema.eventPublicId}
          onRelogin={handleReloginFromWaiting}
        />
      )}

      <LogPanel />
    </main>
  );
}
