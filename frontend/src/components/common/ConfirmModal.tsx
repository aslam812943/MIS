import React from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isDanger = true
}) => {
  if (!isOpen) return null;

  return (
    <div className="mis-modal-backdrop" onClick={onCancel} role="presentation">
      <div
        className="mis-modal max-w-md"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div className="mis-modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <div>
            <h3 id="confirm-modal-title" className="text-lg font-bold m-0 mb-1" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h3>
            <p className="m-0 text-sm" style={{ color: 'var(--text-secondary)' }}>{message}</p>
          </div>
        </div>
        <div className="mis-modal-footer">
          <button type="button" onClick={onCancel} className="mis-btn mis-btn-ghost flex-1 justify-center">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`mis-btn flex-1 justify-center ${isDanger ? 'mis-btn-danger' : 'mis-btn-primary'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
