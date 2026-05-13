import { EventEmitter } from "events";
import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import type { LogLevel, LogEntry } from "../../shared/types";
import { maskSensitive } from "../../shared/mask";

class LogService extends EventEmitter {
  private currentDate = "";
  private currentFilePath = "";

  log(level: LogLevel, source: string, message: string, data?: Record<string, unknown>): void {
    const maskedMessage = maskSensitive(message);
    const maskedData = data ? this.maskData(data) : undefined;

    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      source,
      message: maskedMessage,
      ...(maskedData !== undefined && { data: maskedData }),
    };

    this.appendToFile(entry);
    this.emit("log-entry", entry);
  }

  debug(source: string, message: string, data?: Record<string, unknown>): void {
    this.log("debug", source, message, data);
  }

  info(source: string, message: string, data?: Record<string, unknown>): void {
    this.log("info", source, message, data);
  }

  warn(source: string, message: string, data?: Record<string, unknown>): void {
    this.log("warn", source, message, data);
  }

  error(source: string, message: string, data?: Record<string, unknown>): void {
    this.log("error", source, message, data);
  }

  getLogFilePath(): string {
    return this.resolveFilePath();
  }

  private resolveFilePath(): string {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (today !== this.currentDate) {
      this.currentDate = today;
      const logsDir = path.join(app.getPath("userData"), "logs");
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      this.currentFilePath = path.join(logsDir, `${today}.log`);
    }
    return this.currentFilePath;
  }

  private appendToFile(entry: LogEntry): void {
    try {
      const filePath = this.resolveFilePath();
      const line = JSON.stringify(entry) + "\n";
      fs.appendFileSync(filePath, line, "utf-8");
    } catch {
      // File write failure must not crash the main process
    }
  }

  private maskData(data: Record<string, unknown>): Record<string, unknown> {
    const json = JSON.stringify(data);
    const masked = maskSensitive(json);
    try {
      return JSON.parse(masked) as Record<string, unknown>;
    } catch {
      return { _raw: masked };
    }
  }
}

export const logService = new LogService();
