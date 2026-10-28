import { useState, type ReactNode } from 'react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  id: string;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  /** If set, the user must type this exact text to enable the confirm button. */
  requireText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  // Remount on each open so the typed text resets.
  return props.open ? <ConfirmDialogBody {...props} /> : null;
}

function ConfirmDialogBody({
  id,
  title,
  message,
  confirmLabel,
  danger,
  requireText,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');
  const blocked = requireText !== undefined && typed !== requireText;

  return (
    <Modal open id={id} title={title} onClose={onCancel}>
      <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">{message}</div>
      {requireText !== undefined && (
        <div className="mt-4">
          <label htmlFor={`${id}-input`} className="label">
            Type <span className="font-mono normal-case text-rose-500">{requireText}</span> to confirm
          </label>
          <input
            id={`${id}-input`}
            className="input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoFocus
          />
        </div>
      )}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button id={`${id}-cancel`} type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          id={`${id}-confirm`}
          type="button"
          className={danger ? 'btn-danger' : 'btn-primary'}
          disabled={blocked}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
