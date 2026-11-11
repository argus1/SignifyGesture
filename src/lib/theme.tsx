import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/** Light / Dark / System (spec 1b + 10). Follows prefers-color-scheme unless the person picks one. */
export type ThemeChoice = "system" | "light" | "dark";
const KEY = "signify-theme";

type Ctx = { choice: ThemeChoice; dark: boolean; setChoice: (c: ThemeChoice) => void };
const ThemeCtx = createContext<Ctx>({ choice: "system", dark: false, setChoice: () => {} });

/** Runs before React so the page never flashes the wrong theme. */
export const themeBootScript = `(function(){try{var c=localStorage.getItem('${KEY}')||'system';var d=c==='dark'||(c==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>("system");
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    setChoiceState(read());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const dark = choice === "dark" || (choice === "system" && systemDark);

  useEffect(() => {
    const el = document.documentElement;
    if (el.classList.contains("dark") === dark) return;
    // Colors cross-fade over 250ms when the theme changes (never flash)
    el.classList.add("theme-fade");
    el.classList.toggle("dark", dark);
    const t = setTimeout(() => el.classList.remove("theme-fade"), 300);
    return () => clearTimeout(t);
  }, [dark]);

  const setChoice = useCallback((c: ThemeChoice) => {
    setChoiceState(c);
    try {
      localStorage.setItem(KEY, c);
    } catch {
      /* private mode: keep it for this visit only */
    }
  }, []);

  return <ThemeCtx.Provider value={{ choice, dark, setChoice }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
