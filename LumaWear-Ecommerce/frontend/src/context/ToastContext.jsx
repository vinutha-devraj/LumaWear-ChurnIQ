import { createContext, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = (message) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2600);
  };

  const removeToast = (id) => setToasts((prev) => prev.filter((toast) => toast.id !== id));

  const value = useMemo(() => ({ addToast }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[90] flex w-full max-w-xs flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto rounded-xl2 border border-sand bg-white/95 p-3 text-sm text-charcoal shadow-soft transition"
            role="status"
          >
            <div className="flex items-center justify-between gap-3">
              <p>{toast.message}</p>
              <button
                className="focus-ring rounded-md px-1 py-0.5 text-xs text-charcoal/70 hover:text-ink"
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss notification"
              >
                Close
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
