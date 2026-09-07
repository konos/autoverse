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
    this.write(level, source, message, data, true);
  }

  /**
   * 진단 전용 로그 — 파일에만 남고 렌더러 LogPanel 로는 발행하지 않는다.
   *
   * API 모드의 자격증명 로그인은 내부적으로 보이지 않는 BrowserWindow 를 쓴다
   * (reCAPTCHA 관문 때문에 순수 HTTP 경로가 성립하지 않는다 — R013/R017).
   * 그 기계적 단계(페이지 로드·DOM 주입·버튼 클릭·네비게이션·쿠키 열거·CDP
   * attach)는 사용자에게 보여줄 정보가 아니다. 화면 로그에는 도메인 수준의
   * 서사만 남기고, 재현·디버깅에 필요한 원시 단계는 이 채널로 파일에만 남긴다.
   *
   * 마스킹은 `log()` 와 동일하게 적용된다 — 파일 전용이라고 해서 R010 이
   * 느슨해지지 않는다.
   */
  diag(source: string, message: string, data?: Record<string, unknown>): void {
    this.write("debug", source, message, data, false);
  }

  private write(
    level: LogLevel,
    source: string,
    message: string,
    data: Record<string, unknown> | undefined,
    emitToRenderer: boolean,
  ): void {
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
    if (emitToRenderer) {
      this.emit("log-entry", entry);
    }
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
