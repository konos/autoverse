// ── Log types ─────────────────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  timestamp: string; // ISO-8601
  source: string;
  message: string;
  data?: Record<string, unknown>;
}

// ── Weverse Fanevent Apply API types (§3.2, §3.3) ──────────────────────────

export interface ApplyPeriod {
  formOpenAt: string; // ISO-8601 UTC
  startAt: string;
  endAt: string;
}

export interface FormConfiguration {
  useName: boolean;
  useMiddleName: boolean;
  useBirthDate: boolean;
  usePhone: boolean;
  messengers: null | unknown;
  minAge: number;
  questions: FormQuestion[];
}

export interface FormQuestion {
  questionId: number;
  type: string;
  title: Record<string, string>;
  required: boolean;
  options?: FormQuestionOption[];
}

export interface FormQuestionOption {
  optionId: number;
  label: Record<string, string>;
}

export interface Consent {
  id: number;
  title: Record<string, string>;
  body: Record<string, string>;
  order: number;
}

export interface Reward {
  id: number;
  type: string;
  title: Record<string, string>;
  scheduleStartAt?: string;
}

export interface RewardGroup {
  id: number;
  type: string;
  title: Record<string, string>;
  useCheckIn: boolean;
  isSelectable: boolean;
  maxSelectableCount: number;
  order: number;
  rewards: Reward[];
}

export interface OfficialMembershipResponse {
  region: string;
  membershipNumber: string;
  firstName: string;
  lastName: string;
  endedAt: string;
  requiresConfirmPurchase: boolean;
}

export interface FormSchema {
  eventPublicId: string;
  artistName: string;
  artistCode: string;
  officialMembershipResponse: OfficialMembershipResponse[];
  languages: string[];
  primaryLanguage: string;
  applyPeriod: ApplyPeriod;
  requiresShopPurchaseConsent: boolean;
  applyType: "FIFO" | "DRAW" | string;
  display: {
    headerImageUrl: string | null;
    title: Record<string, string>;
    description: Record<string, string>;
    material: Record<string, string>;
  };
  formConfiguration: FormConfiguration[];
  consents: Consent[];
  rewardGroups: RewardGroup[];
  applyToken: string; // 32-char one-time token — never log plain
  applyHost: string;  // dynamic sharded domain — never hardcode
  responseType: "available" | string;
}

// ── POST payload (§3.3) ────────────────────────────────────────────────────

export interface ApplyPhoneNumber {
  phoneCountryCode: string; // e.g. "82"
  phoneNumber: string;       // digits only, no hyphens
}

export interface ApplyReward {
  rewardGroupId: number;
  rewardIds: number[];
}

export interface ApplyAnswer {
  questionId: number;
  answer: string;
}

export interface ApplyPayload {
  artistCode: string;
  eventPublicId: string;
  application: {
    birthDate: string;                      // YYYY-MM-DD
    applicantPhoneNumber: ApplyPhoneNumber;
    applicationConsentIds: number[];
    applyRewards: ApplyReward[];
    answers: ApplyAnswer[];
  };
}

// ── Status polling (§3.4) ─────────────────────────────────────────────────

export type ApplyStatus =
  | "REQUESTED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "REJECTED"
  | "DUPLICATED"
  | "EXPIRED"
  | string;

export interface StatusResponse {
  status: ApplyStatus;
}

// ── Apply engine event types ────────────────────────────────────────────────

export type ApplyEventType =
  | "form-fetched"
  | "time-synced"
  | "armed"
  | "post-submitted"
  | "poll-result"
  | "completed"
  | "apply-error";

export interface ApplyEvent {
  type: ApplyEventType;
  timestamp: number;
  data?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    statusCode?: number;
  };
}

export type ApplyPhase =
  | "idle"
  | "fetching-form"
  | "form-ready"
  | "waiting-consent"
  | "syncing-time"
  | "armed"
  | "waiting"
  | "firing"
  | "polling"
  | "completed"
  | "error";

export interface ApplyEngineState {
  phase: ApplyPhase;
  phaseTimestamps: Partial<Record<ApplyPhase, number>>;
  postSubmitted: boolean;
  hasSchema: boolean;
  hasSyncResult: boolean;
}

export interface ApplyResult {
  status: "COMPLETED" | "PROCESSING";
  completedAt: number;
}

// ── 나의 신청 내역 확인 (GET /fan/me/applications) ────────────────────────

export interface MyApplicationEntry {
  eventPublicId: string;
  artistCode: string;
  artistName: string;
  status: string; // "APPLIED" | "LOST" | "WON" | ...
  winningInfo: unknown | null;
  eventTitle: Record<string, string>;
  eventPrimaryLanguage: string;
  isExpired: boolean;
}

export interface MyApplicationsResponse {
  contents: MyApplicationEntry[];
}

export interface VerifyResult {
  verified: boolean;
  status?: string;
  eventTitle?: string;
}

// ── Time synchronization (§6) ─────────────────────────────────────────────

export interface TimeSyncResult {
  offsetMs: number;    // serverNowMs - localNowMs (positive = server ahead)
  rttMs: number;       // round-trip time in ms
  serverTime: Date;    // server clock at response receipt
  localTime: Date;     // local clock at midpoint of request
}

// ── Login mode & settings (Phase 06, R016/R021) ────────────────────────────

export type LoginMode = "api" | "browser";

export interface LoginModeSnapshot {
  mode: LoginMode;
  lockedByEnv: boolean;
}

export interface NoticeAckSnapshot {
  ackedVersion: number | null;
  currentVersion: number;
}

// ── Existing types ────────────────────────────────────────────────────────

export interface AuthStatus {
  isLoggedIn: boolean;
  fanId?: number;
  tokenPreview?: string; // "first20...last20" — never full token
  hasStoredCredentials?: boolean;
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
    | "cookie-extraction-failed"
    | "otp-required"
    | "credential-login-progress"
    | "logged-out";
  message?: string;
  timestamp: number;
}

export interface CredentialLoginResult {
  success: boolean;
  needOtp?: boolean;
  message?: string;
}

export interface IpcApi {
  auth: {
    getStatus: () => Promise<AuthStatus>;
    openLogin: () => Promise<void>;
    credentialLogin: (email: string, password: string) => Promise<CredentialLoginResult>;
    submitOtp: (otpCode: string) => Promise<CredentialLoginResult>;
    validateToken: () => Promise<AuthStatus>;
    logout: (clearCredentials?: boolean) => Promise<void>;
    tryAutoLogin: () => Promise<boolean>;
  };
  profile: {
    save: (profile: Profile) => Promise<void>;
    get: () => Promise<Profile | null>;
    clear: () => Promise<void>;
  };
  apply: {
    fetchForm: (eventId: string) => Promise<FormSchema>;
    arm: (rewardIds: number[], consentIds: number[]) => Promise<void>;
    execute: (earlyMs?: number) => Promise<ApplyResult>;
    getState: () => Promise<ApplyEngineState>;
    reset: () => Promise<void>;
    verify: (eventId: string) => Promise<VerifyResult>;
  };
  log: {
    onEntry: (cb: (entry: LogEntry) => void) => () => void;
    download: () => Promise<{ saved: boolean; filePath?: string }>;
  };
  settings: {
    getLoginMode: () => Promise<LoginModeSnapshot>;
    setLoginMode: (mode: LoginMode) => Promise<void>;
    getNoticeAck: () => Promise<NoticeAckSnapshot>;
    ackNotice: (version: number) => Promise<void>;
  };
  onAuthEvent: (cb: (event: AuthEvent) => void) => () => void;
  onApplyEvent: (cb: (event: ApplyEvent) => void) => () => void;
}

declare global {
  interface Window {
    api: IpcApi;
  }
}
