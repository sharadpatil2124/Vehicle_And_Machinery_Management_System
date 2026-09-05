import { useEffect, useRef } from 'react';

export default function Modal({ open, onClose, title, description, children, footer }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const handleCancel = (event) => {
      event.preventDefault();
      onClose();
    };

    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="modal-title"
      className="fixed inset-0 m-auto max-h-[calc(100vh-2rem)] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded border border-steel-200 bg-white p-0 backdrop:bg-brand-900/50"
    >
      <div className="border-b border-steel-200 px-5 py-4">
        <h2 id="modal-title" className="text-base font-semibold text-steel-900">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-steel-500">{description}</p>}
      </div>

      {children && <div className="px-5 py-4">{children}</div>}

      {footer && (
        <div className="flex justify-end gap-2 border-t border-steel-200 bg-steel-50 px-5 py-3">
          {footer}
        </div>
      )}
    </dialog>
  );
}
