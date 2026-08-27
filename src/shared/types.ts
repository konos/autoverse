import type { LoginFailureReason } from "./login-failure";

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
  | "token-expiry-checked"
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

/**
 * `AuthService.getStoredCredentialsSnapshot()` 의 4상태 반환 계약(D-04). 이 타입은
 * main → renderer IPC 경계를 넘는 계약이며, `password` 를 담는 갈래가 존재하지
 * 않는다는 것 자체가 D-01 의 구조적 보장이다 — 복호화된 비밀번호가 이 타입을 통해
 * 렌더러로 나갈 수 있는 경로 자체가 타입 수준에서 없다.
 *
 * - `"none"`: `credentials.enc` 파일이 없다.
 * - `"available"`: 정상 복호화됨 — 저장된 이메일만 노출한다.
 * - `"corrupted"`: 복호화/파싱 실패 — 파일은 이미 삭제된 상태다.
 * - `"unavailable"`: `safeStorage` 자체를 쓸 수 없는 환경 — 파일은 보존된다.
 */
export type StoredCredentialsSnapshot =
  | { state: "none" }
  | { state: "available"; email: string }
  | { state: "corrupted" }
  | { state: "unavailable" };

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
    | "credential-login-progress"
    | "logged-out";
  message?: string;
  timestamp: number;
}

export interface CredentialLoginResult {
  success: boolean;
  message?: string;
  reason?: LoginFailureReason;
  /**
   * 마스킹을 통과한 식별자 — 렌더러가 별도의 작은 칩으로 렌더링한다
   * (UI-SPEC "Identifier format"). network-error/token-ladder-failed/unknown
   * 사유에서만 존재하고, captcha/timeout/form-error 사유에서는 필드 자체가
   * 없다(undefined 문자열이 화면에 찍히는 렌더링을 구조적으로 차단, R010).
   */
  identifier?: string;
}

export interface IpcApi {
  auth: {
    getStatus: () => Promise<AuthStatus>;
    openLogin: () => Promise<void>;
    credentialLogin: (email: string, password: string) => Promise<CredentialLoginResult>;
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
