import { contextBridge, ipcRenderer } from "electron";
import type {
  Profile,
  AuthEvent,
  ApplyEvent,
  LogEntry,
  IpcApi,
  CredentialLoginResult,
  LoginMode,
  LoginModeSnapshot,
  NoticeAckSnapshot,
} from "../shared/types";

const api: IpcApi = {
  auth: {
    getStatus: () => ipcRenderer.invoke("auth:status"),
    openLogin: () => ipcRenderer.invoke("auth:open-login"),
    credentialLogin: (email: string, password: string): Promise<CredentialLoginResult> =>
      ipcRenderer.invoke("auth:credential-login", email, password),
    validateToken: () => ipcRenderer.invoke("auth:validate-token"),
    logout: (clearCredentials?: boolean) =>
      ipcRenderer.invoke("auth:logout", clearCredentials),
    tryAutoLogin: () => ipcRenderer.invoke("auth:auto-login"),
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
  settings: {
    getLoginMode: (): Promise<LoginModeSnapshot> => ipcRenderer.invoke("settings:get-login-mode"),
    setLoginMode: (mode: LoginMode): Promise<void> => ipcRenderer.invoke("settings:set-login-mode", mode),
    getNoticeAck: (): Promise<NoticeAckSnapshot> => ipcRenderer.invoke("settings:get-notice-ack"),
    ackNotice: (version: number): Promise<void> => ipcRenderer.invoke("settings:ack-notice", version),
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
