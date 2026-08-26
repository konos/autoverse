import { useEffect, useRef } from "react";

interface ApiModeNoticeModalProps {
  open: boolean;
  saving: boolean;
  saveError: string | null;
  onAcknowledge: () => void;
  onCancel: () => void;
}

/**
 * 최초 API 모드 선택 시 뜨는 차단형 고지 모달(D-08/D-09/R021).
 *
 * 네이티브 dialog 요소의 모달 표시 메서드를 사용한다 — 포커스 트랩·배경 inert·
 * backdrop을 브라우저가 그대로 제공하므로 "확인해야만 진행" 요건이 구조적으로
 * 성립한다. 비차단 표시 메서드를 쓰면 이 요건이 전부 무너진다.
 *
 * 확인(onAcknowledge)과 취소/Esc(onCancel)는 완전히 분리된 경로다 — Esc는
 * `<dialog>`의 네이티브 `cancel` 이벤트로 들어오며, 이 컴포넌트는 그것을 취소
 * 버튼과 동일한 `onCancel` prop으로 라우팅한다. 시각적으로 닫히는 것만으로
 * 확인 처리가 되지 않는다.
 */
export default function ApiModeNoticeModal({
  open,
  saving,
  saveError,
  onAcknowledge,
  onCancel,
}: ApiModeNoticeModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="notice-modal"
      aria-labelledby="api-mode-notice-title"
      onCancel={(e) => {
        // Escape key fires the native `cancel` event — route it through the
        // same non-acknowledging path as the Cancel button. Do NOT let the
        // dialog's default close-on-Escape behavior stand in for
        // onAcknowledge's side effects.
        e.preventDefault();
        onCancel();
      }}
    >
      <div className="notice-modal-body">
        <h2 id="api-mode-notice-title" className="notice-modal-title">
          API 로그인 방식 안내
        </h2>
        <p>
          Weverse 보안 확인(캡차)이 뜨면 이 방식으로 로그인이 실패할 수 있습니다. 이
          경우 브라우저 로그인 방식을 사용해주세요.
        </p>
        <p>
          자동 재로그인 기능이 없습니다. 앱을 다시 시작하거나 로그인 토큰이 만료되면
          직접 다시 로그인해야 합니다.
        </p>
        {saveError && (
          <p className="error-message" role="alert">
            {saveError}
          </p>
        )}
      </div>
      <div className="button-row">
        <button
          className="btn btn-primary"
          onClick={onAcknowledge}
          disabled={saving}
          aria-busy={saving}
        >
          확인했습니다
        </button>
        <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          취소
        </button>
      </div>
    </dialog>
  );
}
