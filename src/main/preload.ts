import { contextBridge, ipcRenderer } from "electron";
import type { Profile, AuthEvent, IpcApi } from "../shared/types";

const api: IpcApi = {
  auth: {
    getStatus: () => ipcRenderer.invoke("auth:status"),
    openLogin: () => ipcRenderer.invoke("auth:open-login"),
    validateToken: () => ipcRenderer.invoke("auth:validate-token"),
  },
  profile: {
    save: (profile: Profile) => ipcRenderer.invoke("profile:save", profile),
    get: () => ipcRenderer.invoke("profile:get"),
    clear: () => ipcRenderer.invoke("profile:clear"),
  },
  onAuthEvent: (cb: (event: AuthEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: AuthEvent) => cb(event);
    ipcRenderer.on("auth:event", handler);
    return () => ipcRenderer.removeListener("auth:event", handler);
  },
};

contextBridge.exposeInMainWorld("api", api);
