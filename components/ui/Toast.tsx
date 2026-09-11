'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

/**
 * Action feedback, as something that arrives rather than something you have to
 * notice.
 *
 * The store used to answer "added to cart" and "choose a size first" with a
 * line of small type under the button. On a product page that line is below
 * the fold as often as not, and in the quick view it sat under two buttons in
 * a scrolling panel — so the most common reply the shop ever gives was the one
 * thing on the page nobody saw. A toast comes to the shopper instead.
 *
 * Only for feedback about something the shopper just did. Form validation that
 * belongs beside a field stays beside the field; a toast that says "email is
 * required" and then vanishes is strictly worse than a message next to the
 * input it is about.
 */

export type ToastKind = 'ok' | 'error';

type Toast = { id: number; kind: ToastKind; message: string };

type Push = (message: string, kind?: ToastKind) => void;

const ToastContext = createContext<Push | null>(null);

/** Long enough to read a short sentence twice, short enough not to linger. */
const LIFETIME = 4200;

/** Beyond this the stack becomes a wall; the oldest drop off the top. */
const MAX = 3;

const subscribeToNothing = () => () => {};
const onClient = () => true;
const onServer = () => false;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  // Portalled to the body, so no ancestor's `overflow: clip` or stacking
  // context can decide where the shop is allowed to speak from.
  const mounted = useSyncExternalStore(subscribeToNothing, onClient, onServer);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback<Push>(
    (message, kind = 'ok') => {
      if (!message) return;

      const id = (nextId.current += 1);
      setToasts((current) => [...current, { id, kind, message }].slice(-MAX));

      window.setTimeout(() => dismiss(id), LIFETIME);
    },
    [dismiss],
  );

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {mounted
        ? createPortal(
            /* One live region for the whole stack, announced politely. An
               error is still `polite`: it follows something the shopper did,
               so it is never an interruption they did not ask for. */
            <div className="toaster" role="status" aria-live="polite">
              {toasts.map((toast) => (
                <div key={toast.id} className={`toast toast--${toast.kind}`}>
                  <span className="toast__rule" aria-hidden="true" />

                  <p className="toast__text">{toast.message}</p>

                  <button
                    type="button"
                    className="toast__close"
                    onClick={() => dismiss(toast.id)}
                  >
                    <span className="toast__closemark" aria-hidden="true" />
                    <span className="visually-hidden">Dismiss</span>
                  </button>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

/**
 * Never throws and never needs a provider check at the call site: outside a
 * provider it is a no-op, so a component can be dropped into a layout that has
 * no toaster without taking the page down over a status message.
 */
export function useToast(): Push {
  const push = useContext(ToastContext);
  return push ?? noop;
}

const noop: Push = () => {};
