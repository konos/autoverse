import { safeStorage, app } from "electron";
import * as fs from "fs";
import * as path from "path";
import type { Profile } from "../../shared/types";
import { maskPhone, maskBirthDate } from "../../shared/mask";

const PROFILE_FILENAME = "profile.enc";

function getProfilePath(): string {
  return path.join(app.getPath("userData"), PROFILE_FILENAME);
}

export class ProfileStore {
  saveProfile(profile: Profile): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        "safeStorage 암호화를 사용할 수 없습니다 — 평문 저장 거부"
      );
    }

    const json = JSON.stringify(profile);
    const encrypted = safeStorage.encryptString(json);
    const filePath = getProfilePath();

    fs.writeFileSync(filePath, encrypted);

    // Log with masking — never log raw phone/birthDate
    const phoneMasked = profile.phone ? maskPhone(profile.phone) : "없음";
    const birthMasked = profile.birthDate
      ? maskBirthDate(profile.birthDate)
      : "없음";
    console.log(
      `[ProfileStore] saved fanId=${profile.fanId} phone=${phoneMasked} birth=${birthMasked}`
    );
  }

  getProfile(): Profile | null {
    const filePath = getProfilePath();

    if (!fs.existsSync(filePath)) {
      return null;
    }

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        "safeStorage 암호화를 사용할 수 없습니다 — 프로필 읽기 거부"
      );
    }

    let buffer: Buffer;
    try {
      buffer = fs.readFileSync(filePath);
    } catch (err) {
      console.error("[ProfileStore] 파일 읽기 실패:", err);
      throw new Error("프로필 파일 읽기 실패");
    }

    let json: string;
    try {
      json = safeStorage.decryptString(buffer);
    } catch (err) {
      console.error("[ProfileStore] 복호화 실패 — 프로필 삭제 후 재입력 필요:", err);
      this._deleteFile(filePath);
      throw new Error("프로필 복호화 실패 — 프로필이 초기화되었습니다");
    }

    let profile: Profile;
    try {
      profile = JSON.parse(json) as Profile;
    } catch (err) {
      console.error("[ProfileStore] JSON 파싱 실패 — 프로필 삭제:", err);
      this._deleteFile(filePath);
      throw new Error("프로필 데이터 파싱 실패 — 프로필이 초기화되었습니다");
    }

    console.log(`[ProfileStore] loaded fanId=${profile.fanId}`);
    return profile;
  }

  clearProfile(): void {
    const filePath = getProfilePath();
    if (fs.existsSync(filePath)) {
      this._deleteFile(filePath);
      console.log("[ProfileStore] profile cleared");
    }
  }

  private _deleteFile(filePath: string): void {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error("[ProfileStore] 파일 삭제 실패:", err);
    }
  }
}

export const profileStore = new ProfileStore();
