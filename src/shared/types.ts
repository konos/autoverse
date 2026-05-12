export interface AuthStatus {
  isLoggedIn: boolean;
  fanId?: number;
  tokenPreview?: string; // "first20...last20" — never full token
}

export interface Profile {
  fanId: number;
  phone?: string; // stored encrypted, never logged
  birthDate?: string; // stored encrypted, never logged
  name?: string;
}

export interface AuthEvent {
  type:
    | "login-success"
    | "login-failed"
    | "token-expired"
    | "token-validated"
    | "cookie-extraction-failed";
  message?: string;
  timestamp: number;
}

export interface IpcApi {
  auth: {
    getStatus: () => Promise<AuthStatus>;
    openLogin: () => Promise<void>;
    validateToken: () => Promise<AuthStatus>;
  };
  profile: {
    save: (profile: Profile) => Promise<void>;
    get: () => Promise<Profile | null>;
    clear: () => Promise<void>;
  };
  onAuthEvent: (cb: (event: AuthEvent) => void) => () => void;
}

declare global {
  interface Window {
    api: IpcApi;
  }
}
