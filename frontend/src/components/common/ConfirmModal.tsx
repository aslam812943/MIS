import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isDanger = true,
  loading = false,
  icon
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onCancel();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel, loading]);

  if (!isOpen) return null;

  const modalElement = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm"
      style={{ minHeight: '100vh', width: '100vw' }}
      onClick={() => {
        if (!loading) onCancel();
      }}
      role="presentation"
    >
      <div
        className="w-full max-w-md p-6 rounded-2xl shadow-2xl border text-left mx-auto my-auto"
        style={{
          background: 'var(--bg-card)',
          borderColor: 'var(--border)'
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div className="flex items-start gap-3.5">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              isDanger
                ? 'bg-rose-500/15 border border-rose-500/30 text-rose-500'
                : 'bg-teal-500/15 border border-teal-500/30 text-teal-400'
            }`}
          >
            {icon ? (
              icon
            ) : isDanger ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 id="confirm-modal-title" className="text-base font-bold m-0 leading-snug" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {message}
            </p>
          </div>
        </div>

        <div className="flex justify-end items-center gap-3 mt-6 pt-3.5 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors border hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`px-4 py-2 text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-2 ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-50'
                : 'bg-teal-600 hover:bg-teal-700 active:scale-95 disabled:opacity-50'
            }`}
          >
            {loading && (
              <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalElement, document.body) : null;
};

export default ConfirmModal;
