/**
 * Unit tests for ProfileStore — mocks Electron safeStorage/app and fs.
 *
 * Tests:
 *  - saveProfile / getProfile round-trip
 *  - clearProfile deletes file
 *  - getProfile returns null when no file
 *  - safeStorage unavailable → throws (never stores plaintext)
 *  - decryptString failure → deletes corrupted file, throws
 *  - JSON parse failure → deletes file, throws
 *  - repeated saves (idempotent overwrite)
 *  - minimal profile (only fanId)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ── vi.hoisted: declare mocks before the module factory runs ─────────────────
// vi.mock is hoisted to the top of the file; any variables it references must
// also be hoisted via vi.hoisted() so they exist at hoist time.

const { mockSafeStorage, getMockUserDataPath, setMockUserDataPath } = vi.hoisted(() => {
  let _path = "";
  const storage = {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((s: string) => {
      const prefix = Buffer.from("FAKE_ENC:");
      return Buffer.concat([prefix, Buffer.from(s)]);
    }),
    decryptString: vi.fn((buf: Buffer): string => {
      const prefix = Buffer.from("FAKE_ENC:");
      return buf.slice(prefix.length).toString();
    }),
  };
  return {
    mockSafeStorage: storage,
    getMockUserDataPath: () => _path,
    setMockUserDataPath: (p: string) => { _path = p; },
  };
});

vi.mock("electron", () => ({
  safeStorage: mockSafeStorage,
  app: {
    getPath: vi.fn(() => getMockUserDataPath()),
  },
}));

// Import AFTER mock declaration
import { ProfileStore } from "../profile-store";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStore(): { store: ProfileStore; dir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ps-test-"));
  setMockUserDataPath(dir);

  // Reset mocks to default (working) behaviour
  mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
  mockSafeStorage.encryptString.mockImplementation((s: string) => {
    const prefix = Buffer.from("FAKE_ENC:");
    return Buffer.concat([prefix, Buffer.from(s)]);
  });
  mockSafeStorage.decryptString.mockImplementation((buf: Buffer): string => {
    const prefix = Buffer.from("FAKE_ENC:");
    return buf.slice(prefix.length).toString();
  });

  return { store: new ProfileStore(), dir };
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ProfileStore.saveProfile / getProfile round-trip", () => {
  it("saves and loads a full profile", () => {
    const { store, dir } = makeStore();
    const profile = {
      fanId: 1234,
      phone: "01012345678",
      birthDate: "1990-05-15",
      name: "테스트",
    };
    store.saveProfile(profile);
    const loaded = store.getProfile();
    expect(loaded).not.toBeNull();
    expect(loaded?.fanId).toBe(1234);
    expect(loaded?.phone).toBe("01012345678");
    expect(loaded?.birthDate).toBe("1990-05-15");
    expect(loaded?.name).toBe("테스트");
    cleanup(dir);
  });
});

describe("ProfileStore.getProfile — no file", () => {
  it("returns null when profile.enc is absent", () => {
    const { store, dir } = makeStore();
    expect(store.getProfile()).toBeNull();
    cleanup(dir);
  });
});

describe("ProfileStore.clearProfile", () => {
  it("deletes the file after save", () => {
    const { store, dir } = makeStore();
    store.saveProfile({ fanId: 42 });
    const filePath = path.join(dir, "profile.enc");
    expect(fs.existsSync(filePath)).toBe(true);
    store.clearProfile();
    expect(fs.existsSync(filePath)).toBe(false);
    cleanup(dir);
  });

  it("calling clearProfile when no file does not throw", () => {
    const { store, dir } = makeStore();
    expect(() => store.clearProfile()).not.toThrow();
    cleanup(dir);
  });
});

describe("ProfileStore — safeStorage unavailable", () => {
  it("saveProfile throws and writes no file", () => {
    const { store, dir } = makeStore();
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
    expect(() => store.saveProfile({ fanId: 99 })).toThrow("평문 저장 거부");
    expect(fs.existsSync(path.join(dir, "profile.enc"))).toBe(false);
    cleanup(dir);
  });

  it("getProfile throws when encryption unavailable and file exists", () => {
    const { store, dir } = makeStore();
    fs.writeFileSync(path.join(dir, "profile.enc"), Buffer.from("raw"));
    mockSafeStorage.isEncryptionAvailable.mockReturnValue(false);
    expect(() => store.getProfile()).toThrow("프로필 읽기 거부");
    cleanup(dir);
  });
});

describe("ProfileStore — decryptString failure", () => {
  it("throws and deletes the corrupted file", () => {
    const { store, dir } = makeStore();
    store.saveProfile({ fanId: 7 });
    const filePath = path.join(dir, "profile.enc");
    expect(fs.existsSync(filePath)).toBe(true);

    mockSafeStorage.decryptString.mockImplementation(() => {
      throw new Error("decryption failure");
    });

    expect(() => store.getProfile()).toThrow("복호화 실패");
    expect(fs.existsSync(filePath)).toBe(false);
    cleanup(dir);
  });
});

describe("ProfileStore — JSON parse failure", () => {
  it("throws and deletes the file with corrupt JSON", () => {
    const { store, dir } = makeStore();
    store.saveProfile({ fanId: 8 });
    const filePath = path.join(dir, "profile.enc");

    mockSafeStorage.decryptString.mockReturnValue("{invalid json}}");

    expect(() => store.getProfile()).toThrow("파싱 실패");
    expect(fs.existsSync(filePath)).toBe(false);
    cleanup(dir);
  });
});

describe("ProfileStore — repeated saves", () => {
  it("second save overwrites the first", () => {
    const { store, dir } = makeStore();
    store.saveProfile({ fanId: 1 });
    store.saveProfile({ fanId: 2 });
    const loaded = store.getProfile();
    expect(loaded?.fanId).toBe(2);
    cleanup(dir);
  });
});

describe("ProfileStore — minimal profile", () => {
  it("fanId=0 survives round-trip without optional fields", () => {
    const { store, dir } = makeStore();
    store.saveProfile({ fanId: 0 });
    const loaded = store.getProfile();
    expect(loaded?.fanId).toBe(0);
    expect(loaded?.phone).toBeUndefined();
    expect(loaded?.birthDate).toBeUndefined();
    cleanup(dir);
  });

  it("profile with all optional fields undefined is stable", () => {
    const { store, dir } = makeStore();
    store.saveProfile({ fanId: 100, phone: undefined, birthDate: undefined, name: undefined });
    const loaded = store.getProfile();
    expect(loaded?.fanId).toBe(100);
    cleanup(dir);
  });
});
