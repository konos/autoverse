import { app, BrowserWindow, ipcMain, safeStorage } from "electron";
import * as path from "path";
import type { AuthStatus, Profile, AuthEvent } from "../shared/types";

const isDev = process.env.NODE_ENV === "development";

// Token redaction: "first20...last20" per slice constraint
function redactToken(token: string): string {
  if (token.length <= 40) return "***";
  return `${token.slice(0, 20)}...${token.slice(-20)}`;
}

let mainWindow: BrowserWindow | null = null;

// In-memory state (T02/T03 will persist this via safeStorage)
let cachedToken: string | null = null;
let encryptedProfile: Buffer | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // dist/renderer/src/renderer/index.html (vite output with root=".")
    mainWindow.loadFile(
      path.join(__dirname, "../../renderer/src/renderer/index.html")
    );
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function emitAuthEvent(event: AuthEvent): void {
  mainWindow?.webContents.send("auth:event", event);
  const preview = event.message ? ` — ${event.message}` : "";
  console.log(`[AuthEvent] ${event.type}${preview}`);
}

// IPC: auth:status
ipcMain.handle("auth:status", async (): Promise<AuthStatus> => {
  if (!cachedToken) {
    return { isLoggedIn: false };
  }
  return {
    isLoggedIn: true,
    tokenPreview: redactToken(cachedToken),
  };
});

// IPC: auth:open-login — opens Weverse login in a child BrowserWindow
// Cookie extraction is implemented in T02; here we stub the window lifecycle
ipcMain.handle("auth:open-login", async (): Promise<void> => {
  const loginWin = new BrowserWindow({
    width: 500,
    height: 700,
    parent: mainWindow ?? undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  loginWin.loadURL("https://account.weverse.io");

  // Cookie polling is implemented in T02; this hook is the integration point
  loginWin.webContents.on("did-navigate", async (_, url) => {
    if (url.includes("weverse.io") && !url.includes("account.weverse.io")) {
      // Attempt to extract we2_access_token after navigation away from login
      const cookies = await loginWin.webContents.session.cookies.get({
        domain: ".weverse.io",
        name: "we2_access_token",
      });
      if (cookies.length > 0 && cookies[0].value) {
        cachedToken = cookies[0].value;
        emitAuthEvent({
          type: "login-success",
          message: `token ${redactToken(cachedToken)} extracted`,
          timestamp: Date.now(),
        });
        loginWin.close();
      }
    }
  });

  loginWin.on("closed", () => {
    if (!cachedToken) {
      emitAuthEvent({
        type: "cookie-extraction-failed",
        message: "Login window closed without token",
        timestamp: Date.now(),
      });
    }
  });
});

// IPC: auth:validate-token — calls GET /api/fan-api/v1/fans/me (implemented in T02)
ipcMain.handle("auth:validate-token", async (): Promise<AuthStatus> => {
  if (!cachedToken) {
    return { isLoggedIn: false };
  }
  // Full validation implemented in T02; stub returns cached state
  return {
    isLoggedIn: true,
    tokenPreview: redactToken(cachedToken),
  };
});

// IPC: profile:save — encrypts via safeStorage
ipcMain.handle("profile:save", async (_event, profile: Profile): Promise<void> => {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("safeStorage encryption not available on this platform");
  }
  // Never log phone/birthDate
  const json = JSON.stringify(profile);
  encryptedProfile = safeStorage.encryptString(json);
  console.log(`[Profile] saved for fanId=${profile.fanId}`);
});

// IPC: profile:load — decrypts via safeStorage
ipcMain.handle("profile:load", async (): Promise<Profile | null> => {
  if (!encryptedProfile) return null;
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("safeStorage encryption not available on this platform");
  }
  const json = safeStorage.decryptString(encryptedProfile);
  return JSON.parse(json) as Profile;
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
