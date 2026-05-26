import { ipcMain, BrowserWindow, dialog } from "electron";
import * as fs from "fs";
import { authService } from "./services/auth-service";
import { profileStore } from "./services/profile-store";
import { applyEngine } from "./services/apply-engine";
import { logService } from "./services/log-service";
import type { AuthEvent, ApplyEvent, Profile, LogEntry } from "../shared/types";

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

  // auth:credential-login — email/password login via API
  ipcMain.handle("auth:credential-login", async (_evt, email: string, password: string) =>
    authService.credentialLogin(email, password)
  );

  // auth:submit-otp — submit OTP code for credential login
  ipcMain.handle("auth:submit-otp", async (_evt, otpCode: string) =>
    authService.submitOtp(otpCode)
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
  ipcMain.removeHandler("auth:submit-otp");
  ipcMain.removeHandler("auth:validate-token");
  ipcMain.removeHandler("auth:logout");
  ipcMain.removeHandler("auth:auto-login");
  ipcMain.removeHandler("profile:save");
  ipcMain.removeHandler("profile:get");
  ipcMain.removeHandler("profile:clear");
  ipcMain.removeHandler("apply:fetch-form");
  ipcMain.removeHandler("apply:arm");
  ipcMain.removeHandler("apply:execute");
  ipcMain.removeHandler("apply:state");
  ipcMain.removeHandler("apply:reset");
  ipcMain.removeHandler("apply:verify");
  ipcMain.removeHandler("log:download");
}
