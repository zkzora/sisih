"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import {
  initialState,
  restoreDemo,
  storageKey,
  transition,
} from "@/lib/engine";
import type { Action, DemoState, Outcome } from "@/lib/types";
type Toast = { id: number; message: string; error?: boolean };
type ContextValue = {
  state: DemoState;
  ready: boolean;
  act: (action: Action) => Outcome;
  reset: () => void;
  notify: (message: string, error?: boolean) => void;
  moneyModal: "deposit" | "withdraw" | null;
  setMoneyModal: (v: "deposit" | "withdraw" | null) => void;
  storageError: boolean;
  retryStorage: () => void;
};
const SisihContext = createContext<ContextValue | null>(null);
export function SisihProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(() => initialState());
  const stateRef = useRef(state);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [moneyModal, setMoneyModal] = useState<"deposit" | "withdraw" | null>(
    null,
  );
  const [storageError, setStorageError] = useState(false);
  const toastId = useRef(0);
  const notify = (message: string, error = false) => {
    const id = ++toastId.current;
    setToasts((old) => [...old.slice(-2), { id, message, error }]);
    setTimeout(() => setToasts((old) => old.filter((t) => t.id !== id)), 5000);
  };
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const restored = restoreDemo(raw);
        if (restored) {
          stateRef.current = restored;
          setState(restored);
        } else
          notify(
            "Saved demo data could not be restored. A fresh workspace is ready.",
            true,
          );
      }
    } catch {
      setStorageError(true);
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
    document.documentElement.classList.toggle(
      "dark",
      state.preferences.theme === "dark",
    );
  }, [state, ready]);
  const act = (action: Action) => {
    const result = transition(stateRef.current, action);
    if (!result.error) {
      stateRef.current = result.state;
      setState(result.state);
    }
    notify(result.message, Boolean(result.error));
    return result;
  };
  const reset = () => {
    const fresh = initialState();
    stateRef.current = fresh;
    setState(fresh);
    notify("Demo reset. A fresh Session 1 is ready.");
  };
  const retryStorage = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(stateRef.current));
      setStorageError(false);
      notify("Workspace saved in this browser.");
    } catch {
      setStorageError(true);
      notify(
        "Browser storage is unavailable. Your current session still works.",
        true,
      );
    }
  };
  return (
    <SisihContext.Provider
      value={{
        state,
        ready,
        act,
        reset,
        notify,
        moneyModal,
        setMoneyModal,
        storageError,
        retryStorage,
      }}
    >
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div className={`toast ${t.error ? "toast-error" : ""}`} key={t.id}>
            {t.error ? <AlertCircle size={19} /> : <CheckCircle2 size={19} />}
            <span>{t.message}</span>
            <button
              aria-label="Dismiss notification"
              className="icon-button"
              onClick={() =>
                setToasts((old) => old.filter((v) => v.id !== t.id))
              }
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </SisihContext.Provider>
  );
}
export function useSisih() {
  const context = useContext(SisihContext);
  if (!context) throw new Error("SisihProvider is required");
  return context;
}
