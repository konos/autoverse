import { contextBridge, ipcRenderer } from "electron";
import type { Profile, AuthEvent, ApplyEvent, LogEntry, IpcApi, CredentialLoginResult } from "../shared/types";

const api: IpcApi = {
  auth: {
    getStatus: () => ipcRenderer.invoke("auth:status"),
    openLogin: () => ipcRenderer.invoke("auth:open-login"),
    credentialLogin: (email: string, password: string): Promise<CredentialLoginResult> =>
      ipcRenderer.invoke("auth:credential-login", email, password),
    submitOtp: (otpCode: string): Promise<CredentialLoginResult> =>
      ipcRenderer.invoke("auth:submit-otp", otpCode),
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
    execute: (earlyMs?: number) => ipcRenderer.invoke("apply:execute", earlyMs),
    getState: () => ipcRenderer.invoke("apply:state"),
    reset: () => ipcRenderer.invoke("apply:reset"),
    verify: (eventId: string) => ipcRenderer.invoke("apply:verify", eventId),
  },
  log: {
    onEntry: (cb: (entry: LogEntry) => void) => {
      const handler = (_: Electron.IpcRendererEvent, entry: LogEntry) => cb(entry);
      ipcRenderer.on("log:entry", handler);
      return () => ipcRenderer.removeListener("log:entry", handler);
    },
    download: () => ipcRenderer.invoke("log:download"),
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
