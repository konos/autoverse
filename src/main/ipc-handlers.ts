import { ipcMain, BrowserWindow } from "electron";
import { authService } from "./services/auth-service";
import type { AuthEvent, Profile } from "../shared/types";
import { safeStorage } from "electron";

let mainWindowRef: BrowserWindow | null = null;
let encryptedProfile: Buffer | null = null;

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

  // profile:save — encrypt via safeStorage
  ipcMain.handle("profile:save", async (_evt, profile: Profile) => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("safeStorage 암호화를 사용할 수 없습니다");
    }
    const json = JSON.stringify(profile);
    encryptedProfile = safeStorage.encryptString(json);
    console.log(`[Profile] saved fanId=${profile.fanId}`);
  });

  // profile:load — decrypt via safeStorage
  ipcMain.handle("profile:load", async (): Promise<Profile | null> => {
    if (!encryptedProfile) return null;
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("safeStorage 암호화를 사용할 수 없습니다");
    }
    const json = safeStorage.decryptString(encryptedProfile);
    return JSON.parse(json) as Profile;
  });
}

export function unregisterIpcHandlers(): void {
  authService.off("auth-event", forwardAuthEvent);
  ipcMain.removeHandler("auth:status");
  ipcMain.removeHandler("auth:open-login");
  ipcMain.removeHandler("auth:validate-token");
  ipcMain.removeHandler("profile:save");
  ipcMain.removeHandler("profile:load");
}
