import { useEffect, useState } from "react";
import type { Profile } from "../../shared/types";

interface ProfileFormProps {
  fanId: number;
  onSaved: () => void;
}

interface FormState {
  birthDate: string;
  phoneCountryCode: string;
  phoneNumber: string;
}

const EMPTY_FORM: FormState = {
  birthDate: "",
  phoneCountryCode: "+82",
  phoneNumber: "",
};

function profileToForm(p: Profile): FormState {
  const phone = p.phone ?? "";
  // stored format: "+82-01012345678" or just digits
  const match = phone.match(/^(\+\d+)-?(.*)$/);
  return {
    birthDate: p.birthDate ?? "",
    phoneCountryCode: match ? match[1] : "+82",
    phoneNumber: match ? match[2] : phone,
  };
}

export default function ProfileForm({ fanId, onSaved }: ProfileFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    window.api.profile
      .get()
      .then((p) => {
        if (p) setForm(profileToForm(p));
      })
      .catch(() => {
        // no saved profile — start with empty form
      })
      .finally(() => setLoading(false));
  }, [fanId]);

  const handleChange = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError(null);
    setSaved(false);
  };

  const validate = (): string | null => {
    if (!form.birthDate) return "생년월일을 입력해주세요.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate))
      return "생년월일 형식이 올바르지 않습니다 (YYYY-MM-DD).";
    if (!form.phoneNumber) return "전화번호를 입력해주세요.";
    if (!/^\d{9,11}$/.test(form.phoneNumber.replace(/-/g, "")))
      return "전화번호 형식이 올바르지 않습니다.";
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const profile: Profile = {
        fanId,
        birthDate: form.birthDate,
        phone: `${form.phoneCountryCode}-${form.phoneNumber}`,
      };
      await window.api.profile.save(profile);
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "프로필 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="card">
        <p className="muted">프로필 불러오는 중...</p>
      </section>
    );
  }

  return (
    <section className="card" aria-labelledby="profile-heading">
      <h2 id="profile-heading" className="card-title">
        개인 정보 입력
      </h2>
      <p className="card-description">팬 이벤트 응모에 사용할 개인 정보를 입력하세요.</p>

      <div className="form-field">
        <label htmlFor="birthDate" className="form-label">
          생년월일
        </label>
        <input
          id="birthDate"
          type="text"
          className="form-input"
          placeholder="YYYY-MM-DD"
          value={form.birthDate}
          onChange={handleChange("birthDate")}
          maxLength={10}
          aria-required="true"
        />
      </div>

      <div className="form-field">
        <label htmlFor="phoneNumber" className="form-label">
          전화번호
        </label>
        <div className="phone-row">
          <input
            id="phoneCountryCode"
            type="text"
            className="form-input phone-code"
            placeholder="+82"
            value={form.phoneCountryCode}
            onChange={handleChange("phoneCountryCode")}
            maxLength={5}
            aria-label="국가 코드"
          />
          <input
            id="phoneNumber"
            type="text"
            className="form-input phone-number"
            placeholder="01012345678"
            value={form.phoneNumber}
            onChange={handleChange("phoneNumber")}
            aria-required="true"
          />
        </div>
      </div>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {saved && (
        <p className="success-message" role="status">
          프로필이 저장되었습니다.
        </p>
      )}

      <div className="button-row">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
          aria-busy={saving}
        >
          {saving ? "저장 중..." : "확인"}
        </button>
      </div>
    </section>
  );
}
