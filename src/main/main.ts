import { app, BrowserWindow } from "electron";
import * as path from "path";
import { registerIpcHandlers, setMainWindow } from "./ipc-handlers";
import { authService } from "./services/auth-service";
import { logService } from "./services/log-service";

const isDev = process.env.NODE_ENV === "development";

let mainWindow: BrowserWindow | null = null;

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

  setMainWindow(mainWindow);

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, "../../renderer/src/renderer/index.html")
    );
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
    setMainWindow(null);
  });
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  createWindow();

  // Auto-login with stored credentials on app start
  try {
    const ok = await authService.tryAutoLogin();
    if (ok) {
      logService.info("Main", "auto-login succeeded on startup");
    } else {
      logService.info("Main", "auto-login skipped or failed — manual login required");
    }
  } catch (err) {
    logService.error("Main", `auto-login error: ${String(err)}`);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
