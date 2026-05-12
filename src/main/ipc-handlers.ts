import { ipcMain, BrowserWindow } from "electron";
import { authService } from "./services/auth-service";
import { profileStore } from "./services/profile-store";
import type { AuthEvent, Profile } from "../shared/types";

let mainWindowRef: BrowserWindow | null = null;

export function setMainWindow(win: BrowserWindow | null): void {
  mainWindowRef = win;
}

/** Broadcast any AuthService event to the renderer via auth:event channel */
function forwardAuthEvent(event: AuthEvent): void {
  mainWindowRef?.webContents.send("auth:event", event);
}

export function registerIpcHandlers(): void {
  // Forward all auth events to renderer
  authService.on("auth-event", forwardAuthEvent);

  // auth:status — current login state
  ipcMain.handle("auth:status", async () => authService.getStatus());

  // auth:open-login — opens Weverse BrowserWindow login
  ipcMain.handle("auth:open-login", async () => {
    await authService.login(mainWindowRef);
  });

  // auth:validate-token — calls GET /fans/me
  ipcMain.handle("auth:validate-token", async () =>
    authService.validateToken()
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
}

export function unregisterIpcHandlers(): void {
  authService.off("auth-event", forwardAuthEvent);
  ipcMain.removeHandler("auth:status");
  ipcMain.removeHandler("auth:open-login");
  ipcMain.removeHandler("auth:validate-token");
  ipcMain.removeHandler("profile:save");
  ipcMain.removeHandler("profile:get");
  ipcMain.removeHandler("profile:clear");
}
