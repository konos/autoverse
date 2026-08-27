import { ipcMain, BrowserWindow, dialog } from "electron";
import * as fs from "fs";
import { authService } from "./services/auth-service";
import { profileStore } from "./services/profile-store";
import { settingsStore } from "./services/settings-store";
import { applyEngine } from "./services/apply-engine";
import { logService } from "./services/log-service";
import type { AuthEvent, ApplyEvent, Profile, LogEntry, LoginMode } from "../shared/types";

let mainWindowRef: BrowserWindow | null = null;

export function setMainWindow(win: BrowserWindow | null): void {
  mainWindowRef = win;
}

/** Broadcast any AuthService event to the renderer via auth:event channel */
function forwardAuthEvent(event: AuthEvent): void {
  mainWindowRef?.webContents.send("auth:event", event);
}

/** Broadcast any ApplyEngine event to the renderer via apply:event channel */
function forwardApplyEvent(event: ApplyEvent): void {
  mainWindowRef?.webContents.send("apply:event", event);
}

/** Forward LogService log-entry events to renderer via log:entry channel */
function forwardLogEntry(entry: LogEntry): void {
  mainWindowRef?.webContents.send("log:entry", entry);
}

export function registerIpcHandlers(): void {
  // Forward all auth events to renderer
  authService.on("auth-event", forwardAuthEvent);

  // Forward all apply engine events to renderer
  applyEngine.on("apply-event", forwardApplyEvent);

  // Forward all log entries to renderer
  logService.on("log-entry", forwardLogEntry);

  // auth:status — current login state
  ipcMain.handle("auth:status", async () => authService.getStatus());

  // auth:open-login — opens Weverse BrowserWindow login
  ipcMain.handle("auth:open-login", async () => {
    await authService.login(mainWindowRef);
  });

  // auth:credential-login — email/password login. D-01: API 모드의 실체가
  // credentialLogin() 헤드리스 자동입력 경로 그 자체이므로, 모드 분기는 없다 —
  // 이 한 줄이 API 모드의 유일한 진입점이다.
  ipcMain.handle("auth:credential-login", async (_evt, email: string, password: string) =>
    authService.credentialLogin(email, password)
  );

  // auth:validate-token — calls GET /fans/me
  ipcMain.handle("auth:validate-token", async () =>
    authService.validateToken()
  );

  // auth:logout — clear token, optionally clear saved credentials
  ipcMain.handle("auth:logout", async (_evt, clearCredentials?: boolean) =>
    authService.logout(clearCredentials ?? false)
  );

  // auth:auto-login — attempt login with stored credentials
  ipcMain.handle("auth:auto-login", async () =>
    authService.tryAutoLogin()
  );

  // auth:get-stored-credentials — D-04 4상태 계약을 그대로 반환. 인자 없음,
  // password 필드는 어떤 상태에도 존재하지 않는다(D-01).
  ipcMain.handle("auth:get-stored-credentials", async () =>
    authService.getStoredCredentialsSnapshot()
  );

  // auth:credential-login-stored — 저장된 비밀번호로 로그인(D-01/D-06). 비밀번호는
  // 인자로 받지 않는다 — 계약 자체가 이메일 하나뿐이다. WR-04 선례(런타임 검증
  // 없이 임의 값을 받아들인 결함)를 반복하지 않기 위해, 이 채널은 외부에
  // 부수효과(실제 로그인 요청)를 만들므로 타입 캐스팅만 믿지 않고 런타임에
  // `typeof` 를 검사한 뒤에만 authService 를 호출한다.
  ipcMain.handle("auth:credential-login-stored", async (_evt, email: unknown) => {
    if (typeof email !== "string") {
      throw new Error("email 인자가 문자열이 아닙니다");
    }
    return authService.loginWithStoredCredentials(email);
  });

  // auth:clear-credentials — 로그인 상태와 무관하게 저장된 자격증명을 삭제한다(D-06).
  // 로그아웃(토큰/세션 초기화)은 수행하지 않는다.
  ipcMain.handle("auth:clear-credentials", async () => {
    authService.clearCredentials();
  });

  // profile:save — encrypt via safeStorage, persist to disk
  ipcMain.handle("profile:save", async (_evt, profile: Profile) => {
    profileStore.saveProfile(profile);
  });

  // profile:get — decrypt from disk via safeStorage
  ipcMain.handle("profile:get", async (): Promise<Profile | null> => {
    return profileStore.getProfile();
  });

  // profile:clear — delete encrypted profile file
  ipcMain.handle("profile:clear", async () => {
    profileStore.clearProfile();
  });

  // apply:fetch-form — fetch and validate form schema
  ipcMain.handle("apply:fetch-form", async (_evt, eventId: string) =>
    applyEngine.fetchForm(eventId)
  );

  // apply:arm — set reward/consent selections
  ipcMain.handle(
    "apply:arm",
    async (_evt, rewardIds: number[], consentIds: number[]) =>
      applyEngine.arm(rewardIds, consentIds)
  );

  // apply:execute — run the full apply flow (earlyMs: user-configured pre-submit offset)
  ipcMain.handle("apply:execute", async (_evt, earlyMs?: number) =>
    applyEngine.execute(earlyMs ?? 0)
  );

  // apply:state — query current engine state
  ipcMain.handle("apply:state", async () => applyEngine.getState());

  // apply:reset — reset engine for next event
  ipcMain.handle("apply:reset", async () => applyEngine.reset());

  // apply:verify — check application status from server
  ipcMain.handle("apply:verify", async (_evt, eventId: string) =>
    applyEngine.verifyApplication(eventId)
  );

  // apply:check-token-expiry — 만료 재판정 진입점(D-10). 재로그인 뒤 새 토큰의
  // exp 로 다시 판정하기 위해 존재한다. phase/postSubmitted 를 건드리지 않는다.
  ipcMain.handle("apply:check-token-expiry", async () =>
    applyEngine.checkTokenExpiry()
  );

  // settings:get-login-mode — resolved mode (env override > persisted) + lock flag (D-06)
  ipcMain.handle("settings:get-login-mode", async () => settingsStore.getLoginModeSnapshot());

  // settings:set-login-mode — persist the user-selected mode. Runtime
  // validation (WR-04) happens inside SettingsStore.setLoginMode() itself,
  // not here — that keeps every call path (not just this IPC channel) behind
  // one gate. Duplicating the check here would only drift out of sync.
  ipcMain.handle("settings:set-login-mode", async (_evt, mode: LoginMode) => {
    settingsStore.setLoginMode(mode);
  });

  // settings:get-notice-ack — API mode notice acknowledgement state
  ipcMain.handle("settings:get-notice-ack", async () => settingsStore.getNoticeAck());

  // settings:ack-notice — record that the user acknowledged the API mode notice
  ipcMain.handle("settings:ack-notice", async (_evt, version: number) => {
    settingsStore.ackNotice(version);
  });

  // log:download — SaveDialog → fs.copyFile to user-chosen destination
  ipcMain.handle("log:download", async () => {
    const srcPath = logService.getLogFilePath();
    const { canceled, filePath: destPath } = await dialog.showSaveDialog({
      defaultPath: srcPath.split("/").pop() ?? "app.log",
      filters: [{ name: "Log Files", extensions: ["log"] }],
    });
    if (canceled || !destPath) {
      return { saved: false };
    }
    await fs.promises.copyFile(srcPath, destPath);
    return { saved: true, filePath: destPath };
  });
}

export function unregisterIpcHandlers(): void {
  authService.off("auth-event", forwardAuthEvent);
  applyEngine.off("apply-event", forwardApplyEvent);
  logService.off("log-entry", forwardLogEntry);
  ipcMain.removeHandler("auth:status");
  ipcMain.removeHandler("auth:open-login");
  ipcMain.removeHandler("auth:credential-login");
  ipcMain.removeHandler("auth:validate-token");
  ipcMain.removeHandler("auth:logout");
  ipcMain.removeHandler("auth:auto-login");
  ipcMain.removeHandler("auth:get-stored-credentials");
  ipcMain.removeHandler("auth:credential-login-stored");
  ipcMain.removeHandler("auth:clear-credentials");
  ipcMain.removeHandler("profile:save");
  ipcMain.removeHandler("profile:get");
  ipcMain.removeHandler("profile:clear");
  ipcMain.removeHandler("apply:fetch-form");
  ipcMain.removeHandler("apply:arm");
  ipcMain.removeHandler("apply:execute");
  ipcMain.removeHandler("apply:state");
  ipcMain.removeHandler("apply:reset");
  ipcMain.removeHandler("apply:verify");
  ipcMain.removeHandler("apply:check-token-expiry");
  ipcMain.removeHandler("settings:get-login-mode");
  ipcMain.removeHandler("settings:set-login-mode");
  ipcMain.removeHandler("settings:get-notice-ack");
  ipcMain.removeHandler("settings:ack-notice");
  ipcMain.removeHandler("log:download");
}
