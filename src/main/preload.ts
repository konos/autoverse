import { contextBridge, ipcRenderer } from "electron";
import type { Profile, AuthEvent, ApplyEvent, IpcApi } from "../shared/types";

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
  apply: {
    fetchForm: (eventId: string) => ipcRenderer.invoke("apply:fetch-form", eventId),
    arm: (rewardIds: number[], consentIds: number[]) =>
      ipcRenderer.invoke("apply:arm", rewardIds, consentIds),
    execute: () => ipcRenderer.invoke("apply:execute"),
    getState: () => ipcRenderer.invoke("apply:state"),
    reset: () => ipcRenderer.invoke("apply:reset"),
  },
  onAuthEvent: (cb: (event: AuthEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: AuthEvent) => cb(event);
    ipcRenderer.on("auth:event", handler);
    return () => ipcRenderer.removeListener("auth:event", handler);
  },
  onApplyEvent: (cb: (event: ApplyEvent) => void) => {
    const handler = (_: Electron.IpcRendererEvent, event: ApplyEvent) => cb(event);
    ipcRenderer.on("apply:event", handler);
    return () => ipcRenderer.removeListener("apply:event", handler);
  },
};

contextBridge.exposeInMainWorld("api", api);
