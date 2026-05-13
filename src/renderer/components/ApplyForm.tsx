import { useEffect, useState } from "react";
import type { FormSchema, Profile, RewardGroup, Consent } from "../../shared/types";
import { maskPhone, maskBirthDate } from "../../shared/mask";

interface ApplyFormProps {
  schema: FormSchema;
  fanId: number;
  onArmed: () => void;
}

function getLang(record: Record<string, string>, lang: string): string {
  return record[lang] ?? record["ko"] ?? Object.values(record)[0] ?? "";
}

export default function ApplyForm({ schema, fanId, onArmed }: ApplyFormProps) {
  const lang = schema.primaryLanguage ?? "ko";

  // Selectable reward groups only
  const selectableGroups: RewardGroup[] = schema.rewardGroups.filter((g) => g.isSelectable);

  // selectedRewardIds: group id → reward id (single-select per group)
  const [selectedRewardIds, setSelectedRewardIds] = useState<Record<number, number>>({});

  // Consent checkboxes — all default false (R009 자동 체크 금지)
  const [checkedConsents, setCheckedConsents] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(schema.consents.map((c) => [c.id, false]))
  );
  const [expandedConsents, setExpandedConsents] = useState<Record<number, boolean>>({});

  // Profile confirmation
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileConfirmed, setProfileConfirmed] = useState(false);

  // Arm state
  const [arming, setArming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.api.profile
      .get()
      .then((p) => setProfile(p))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }, [fanId]);

  const allConsentsChecked =
    schema.consents.length === 0 || schema.consents.every((c) => checkedConsents[c.id]);

  const allGroupsSelected =
    selectableGroups.length === 0 ||
    selectableGroups.every((g) => selectedRewardIds[g.id] !== undefined);

  const canArm = allConsentsChecked && allGroupsSelected && profileConfirmed && !arming;

  const handleArm = async () => {
    setArming(true);
    setError(null);
    try {
      const rewardIds = Object.values(selectedRewardIds);
      const consentIds = schema.consents.filter((c) => checkedConsents[c.id]).map((c) => c.id);
      await window.api.apply.arm(rewardIds, consentIds);
      onArmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "신청 준비에 실패했습니다.");
    } finally {
      setArming(false);
    }
  };

  return (
    <section className="card" aria-labelledby="apply-form-heading">
      <h2 id="apply-form-heading" className="card-title">
        신청 폼
      </h2>

      {/* 회차 선택 */}
      {selectableGroups.length > 0 && (
        <div className="form-section">
          {selectableGroups.map((group) => (
            <div key={group.id} className="form-field">
              <p className="form-label">{getLang(group.title, lang)}</p>
              <div className="reward-options">
                {group.rewards.map((reward) => (
                  <label key={reward.id} className="radio-label">
                    <input
                      type="radio"
                      name={`reward-group-${group.id}`}
                      value={reward.id}
                      checked={selectedRewardIds[group.id] === reward.id}
                      onChange={() =>
                        setSelectedRewardIds((prev) => ({ ...prev, [group.id]: reward.id }))
                      }
                    />
                    <span>
                      {getLang(reward.title, lang)}
                      {reward.scheduleStartAt && (
                        <span className="muted" style={{ marginLeft: "0.4rem" }}>
                          ({new Date(reward.scheduleStartAt).toLocaleDateString("ko-KR")})
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 약관 동의 */}
      {schema.consents.length > 0 && (
        <div className="form-section">
          <p className="form-label" style={{ marginBottom: "0.5rem" }}>
            약관 동의
          </p>
          {schema.consents.map((consent: Consent) => (
            <div key={consent.id} className="consent-item">
              <div className="consent-header">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={checkedConsents[consent.id] ?? false}
                    onChange={(e) =>
                      setCheckedConsents((prev) => ({
                        ...prev,
                        [consent.id]: e.target.checked,
                      }))
                    }
                  />
                  <span>{getLang(consent.title, lang)}</span>
                </label>
                <button
                  className="btn-text"
                  type="button"
                  onClick={() =>
                    setExpandedConsents((prev) => ({
                      ...prev,
                      [consent.id]: !prev[consent.id],
                    }))
                  }
                  aria-expanded={expandedConsents[consent.id] ?? false}
                >
                  {expandedConsents[consent.id] ? "접기" : "전문 보기"}
                </button>
              </div>
              {expandedConsents[consent.id] && (
                <div className="consent-body">
                  <p className="muted" style={{ whiteSpace: "pre-wrap", fontSize: "0.78rem" }}>
                    {getLang(consent.body, lang)}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 프로필 확인 */}
      <div className="form-section">
        <p className="form-label" style={{ marginBottom: "0.5rem" }}>
          신청자 정보 확인
        </p>
        {profileLoading ? (
          <p className="muted">프로필 불러오는 중...</p>
        ) : profile ? (
          <div>
            <div className="status-row">
              <span className="status-label">전화번호</span>
              <span className="status-value">{maskPhone(profile.phone ?? "")}</span>
            </div>
            <div className="status-row">
              <span className="status-label">생년월일</span>
              <span className="status-value">{maskBirthDate(profile.birthDate ?? "")}</span>
            </div>
            <div className="button-row" style={{ marginTop: "0.5rem" }}>
              <button
                className={`btn ${profileConfirmed ? "btn-success" : "btn-primary"}`}
                type="button"
                onClick={() => setProfileConfirmed(true)}
                disabled={profileConfirmed}
              >
                {profileConfirmed ? "확인 완료" : "이 정보로 신청합니다"}
              </button>
            </div>
          </div>
        ) : (
          <p className="error-message">저장된 프로필이 없습니다. 프로필을 먼저 입력해주세요.</p>
        )}
      </div>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      <div className="button-row">
        <button
          className="btn btn-primary"
          onClick={handleArm}
          disabled={!canArm}
          aria-busy={arming}
        >
          {arming ? "준비 중..." : "신청 준비"}
        </button>
      </div>
    </section>
  );
}
