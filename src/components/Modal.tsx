import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** id used for aria-labelledby and testing */
  id: string;
}

/** Bottom sheet on mobile, centered dialog on larger screens. */
export function Modal({ open, title, onClose, children, id }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <div className="animate-fade-in absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <section
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className="animate-sheet-up relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl dark:bg-slate-900"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300 sm:hidden dark:bg-white/20" />
        <h2 id={`${id}-title`} className="mb-4 text-lg font-semibold">
          {title}
        </h2>
        {children}
      </section>
    </div>
  );
}
