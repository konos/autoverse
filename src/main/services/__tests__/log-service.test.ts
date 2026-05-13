import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import type { LogEntry } from "../../../shared/types";

// ── Electron mock ─────────────────────────────────────────────────────────────
vi.mock("electron", () => ({
  app: {
    getPath: (_name: string) => "/tmp/autoverse-test",
  },
}));

// ── fs mock ───────────────────────────────────────────────────────────────────
const appendedLines: string[] = [];
vi.mock("fs", () => ({
  existsSync: () => true,
  mkdirSync: vi.fn(),
  appendFileSync: (_path: string, data: string) => {
    appendedLines.push(data);
  },
}));

// ── Import after mocks ─────────────────────────────────────────────────────────
const { logService } = await import("../log-service");

describe("LogService", () => {
  beforeEach(() => {
    appendedLines.length = 0;
  });

  afterEach(() => {
    logService.removeAllListeners();
  });

  it("is an EventEmitter", () => {
    expect(logService).toBeInstanceOf(EventEmitter);
  });

  it("emits log-entry event on log()", () => {
    const entries: LogEntry[] = [];
    logService.on("log-entry", (e: LogEntry) => entries.push(e));

    logService.log("info", "test", "hello world");

    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe("info");
    expect(entries[0].source).toBe("test");
    expect(entries[0].message).toBe("hello world");
  });

  it("LogEntry contains level, timestamp, source, message", () => {
    const entries: LogEntry[] = [];
    logService.on("log-entry", (e: LogEntry) => entries.push(e));

    logService.log("warn", "auth-service", "token expired");

    const entry = entries[0];
    expect(entry).toHaveProperty("level");
    expect(entry).toHaveProperty("timestamp");
    expect(entry).toHaveProperty("source");
    expect(entry).toHaveProperty("message");
    expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
  });

  it("appends JSON line to file", () => {
    logService.log("debug", "apply-engine", "test file write");

    expect(appendedLines.length).toBeGreaterThan(0);
    const parsed = JSON.parse(appendedLines[appendedLines.length - 1]) as LogEntry;
    expect(parsed.message).toBe("test file write");
  });

  it("masks phoneNumber in message", () => {
    const entries: LogEntry[] = [];
    logService.on("log-entry", (e: LogEntry) => entries.push(e));

    logService.log("info", "weverse-api", `phoneNumber: "01012345678"`);

    expect(entries[0].message).toContain("****5678");
    expect(entries[0].message).not.toContain("01012345678");
  });

  it("masks birthDate in message", () => {
    const entries: LogEntry[] = [];
    logService.on("log-entry", (e: LogEntry) => entries.push(e));

    logService.log("info", "profile-store", `birthDate: "1990-05-15"`);

    expect(entries[0].message).toContain("1990-**-**");
    expect(entries[0].message).not.toContain("1990-05-15");
  });

  it("masks data fields via maskSensitive", () => {
    const entries: LogEntry[] = [];
    logService.on("log-entry", (e: LogEntry) => entries.push(e));

    logService.log("debug", "auth", "payload", {
      membershipNumber: "MEM12345678",
    });

    const dataStr = JSON.stringify(entries[0].data);
    expect(dataStr).not.toContain("MEM12345678");
  });

  it("getLogFilePath() returns a string with YYYY-MM-DD", () => {
    const filePath = logService.getLogFilePath();
    expect(typeof filePath).toBe("string");
    expect(filePath).toMatch(/\d{4}-\d{2}-\d{2}\.log$/);
  });

  it("convenience methods (debug/info/warn/error) all emit log-entry", () => {
    const levels: string[] = [];
    logService.on("log-entry", (e: LogEntry) => levels.push(e.level));

    logService.debug("src", "debug msg");
    logService.info("src", "info msg");
    logService.warn("src", "warn msg");
    logService.error("src", "error msg");

    expect(levels).toEqual(["debug", "info", "warn", "error"]);
  });
});
