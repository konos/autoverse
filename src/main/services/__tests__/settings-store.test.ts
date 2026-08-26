/**
 * Unit tests for SettingsStore — mocks Electron `app.getPath` and writes to
 * a real temp directory (same convention as profile-store.test.ts), but
 * WITHOUT mocking safeStorage — settings.json is plaintext (D-05).
 *
 * Tests:
 *  - getLoginMode() defaults to "browser" when no file exists
 *  - setLoginMode() round-trips across a fresh SettingsStore instance (restart)
 *  - corrupt JSON → getLoginMode() falls back to "browser", never throws, logs a warning
 *  - unknown loginMode value ("legacy") normalizes to "browser"
 *  - two consecutive setLoginMode() calls always leave valid JSON with the last value
 *  - setLoginMode() writes via a tmp path + fs.renameSync (spy-verified)
 *  - getLoginModeSnapshot() — env unset + persisted "api" → { mode: "api", lockedByEnv: false }
 *  - getLoginModeSnapshot() — env "browser" + persisted "api" → { mode: "browser", lockedByEnv: true }
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const { getMockUserDataPath, setMockUserDataPath } = vi.hoisted(() => {
  let _path = "";
  return {
    getMockUserDataPath: () => _path,
    setMockUserDataPath: (p: string) => { _path = p; },
  };
});

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => getMockUserDataPath()),
  },
}));

// Partial fs mock — real implementation for everything, but renameSync/
// writeFileSync are wrapped in vi.fn() so call arguments can be inspected
// (vi.spyOn cannot patch a live ESM namespace export directly).
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    renameSync: vi.fn(actual.renameSync),
    writeFileSync: vi.fn(actual.writeFileSync),
  };
});

// Import AFTER mock declaration
import { SettingsStore } from "../settings-store";
import { logService } from "../log-service";

function makeStore(): { store: SettingsStore; dir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ss-test-"));
  setMockUserDataPath(dir);
  return { store: new SettingsStore(), dir };
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SettingsStore.getLoginMode — 파일 없음", () => {
  it("파일이 없으면 기본값 browser 를 반환한다", () => {
    const { store, dir } = makeStore();
    expect(store.getLoginMode()).toBe("browser");
    cleanup(dir);
  });
});

describe("SettingsStore.setLoginMode / getLoginMode — 재시작 라운드트립", () => {
  it("setLoginMode('api') 후 새 인스턴스로 조회해도 api 가 유지된다", () => {
    const { store, dir } = makeStore();
    store.setLoginMode("api");

    const restarted = new SettingsStore();
    expect(restarted.getLoginMode()).toBe("api");
    cleanup(dir);
  });
});

describe("SettingsStore.getLoginMode — 손상된 JSON", () => {
  it("파싱 실패 시 던지지 않고 browser 로 폴백하며 경고 로그를 1회 남긴다", () => {
    const { store, dir } = makeStore();
    const filePath = path.join(dir, "settings.json");
    fs.writeFileSync(filePath, "{ this is not valid json");

    const warnSpy = vi.spyOn(logService, "warn");

    let mode: string | undefined;
    expect(() => { mode = store.getLoginMode(); }).not.toThrow();
    expect(mode).toBe("browser");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toBe("SettingsStore");
    cleanup(dir);
  });
});

describe("SettingsStore.getLoginMode — 알 수 없는 값 정규화", () => {
  it('loginMode 필드가 "legacy" 이면 browser 로 정규화한다', () => {
    const { store, dir } = makeStore();
    const filePath = path.join(dir, "settings.json");
    fs.writeFileSync(
      filePath,
      JSON.stringify({ schemaVersion: 1, loginMode: "legacy", apiModeNoticeAckedVersion: null }),
    );

    expect(store.getLoginMode()).toBe("browser");
    cleanup(dir);
  });
});

describe("SettingsStore.setLoginMode — 연속 호출과 원자적 쓰기", () => {
  it("두 번 연속 호출해도 파일은 항상 유효한 JSON 이며 마지막 값이 남는다", () => {
    const { store, dir } = makeStore();
    store.setLoginMode("api");
    store.setLoginMode("browser");

    const filePath = path.join(dir, "settings.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    expect(() => JSON.parse(raw)).not.toThrow();
    const parsed = JSON.parse(raw);
    expect(parsed.loginMode).toBe("browser");
    cleanup(dir);
  });

  it("setLoginMode() 는 임시 경로에 쓴 뒤 fs.renameSync 로 교체한다", () => {
    const { store, dir } = makeStore();
    const renameSpy = vi.mocked(fs.renameSync);
    const writeSpy = vi.mocked(fs.writeFileSync);
    renameSpy.mockClear();
    writeSpy.mockClear();

    store.setLoginMode("api");

    expect(writeSpy).toHaveBeenCalled();
    const tmpArg = writeSpy.mock.calls[writeSpy.mock.calls.length - 1][0] as string;
    expect(String(tmpArg)).toMatch(/\.tmp$/);

    expect(renameSpy).toHaveBeenCalled();
    const [renameFrom, renameTo] = renameSpy.mock.calls[renameSpy.mock.calls.length - 1];
    expect(String(renameFrom)).toMatch(/\.tmp$/);
    expect(String(renameTo)).toBe(path.join(dir, "settings.json"));

    cleanup(dir);
  });
});

describe("SettingsStore.getLoginModeSnapshot — env 우선순위 (D-06)", () => {
  it("env 미설정 + 저장값 api → { mode: 'api', lockedByEnv: false }", () => {
    const { store, dir } = makeStore();
    store.setLoginMode("api");

    const snapshot = store.getLoginModeSnapshot({});
    expect(snapshot).toEqual({ mode: "api", lockedByEnv: false });
    cleanup(dir);
  });

  it("env browser + 저장값 api → { mode: 'browser', lockedByEnv: true }", () => {
    const { store, dir } = makeStore();
    store.setLoginMode("api");

    const snapshot = store.getLoginModeSnapshot({ AUTOVERSE_LOGIN_MODE: "browser" });
    expect(snapshot).toEqual({ mode: "browser", lockedByEnv: true });
    cleanup(dir);
  });
});
