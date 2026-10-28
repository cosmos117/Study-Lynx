import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const FeedbackContext = createContext(null);
const TOAST_MS = 5000;

/**
 * App-wide feedback: short toasts for the result of an action, and an accessible
 * confirmation dialog (native <dialog>, so focus is trapped and Escape cancels).
 *
 *   const { toast, confirm } = useFeedback();
 *   toast('Saved');  toast('Could not save', 'error');
 *   if (await confirm({ title: 'Delete exam?', message: '...', confirmLabel: 'Delete', danger: true })) { ... }
 */
export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const dialogRef = useRef(null);
  const nextId = useRef(0);

  const toast = useCallback((message, tone = 'success') => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), TOAST_MS);
  }, []);

  const confirm = useCallback((options) => new Promise((resolve) => setDialog({ ...options, resolve })), []);

  useEffect(() => {
    if (dialog && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [dialog]);

  const close = (result) => {
    dialogRef.current?.close();
    dialog.resolve(result);
    setDialog(null);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <div className="lynx-toasts" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} role={item.tone === 'error' ? 'alert' : 'status'} className={`lynx-toast lynx-toast-${item.tone}`}>{item.message}</div>
        ))}
      </div>
      <dialog
        ref={dialogRef}
        className="lynx-dialog"
        aria-labelledby="lynx-dialog-title"
        aria-describedby="lynx-dialog-message"
        onCancel={(event) => { event.preventDefault(); close(false); }}
      >
        {dialog && (
          <div className="lynx-dialog-body">
            <h2 id="lynx-dialog-title" className="lynx-h2">{dialog.title}</h2>
            <p id="lynx-dialog-message" className="lynx-muted lynx-sub">{dialog.message}</p>
            <div className="lynx-dialog-actions">
              <button type="button" autoFocus onClick={() => close(false)} className="lynx-btn lynx-btn-ghost">{dialog.cancelLabel || 'Cancel'}</button>
              <button type="button" onClick={() => close(true)} className={`lynx-btn ${dialog.danger ? 'lynx-btn-danger' : 'lynx-btn-primary'}`}>{dialog.confirmLabel || 'Confirm'}</button>
            </div>
          </div>
        )}
      </dialog>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback must be used inside FeedbackProvider');
  return context;
}
