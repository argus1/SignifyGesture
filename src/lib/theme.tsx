import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/** Appearance: Light or Dark (spec 1b). Opens in light; dark only when the person picks it. */
export type ThemeChoice = "light" | "dark";
const KEY = "signify-theme";

type Ctx = { choice: ThemeChoice; dark: boolean; setChoice: (c: ThemeChoice) => void };
const ThemeCtx = createContext<Ctx>({ choice: "light", dark: false, setChoice: () => {} });

/** Runs before React so the page never flashes the wrong theme. */
export const themeBootScript = `(function(){try{document.documentElement.classList.toggle('dark',localStorage.getItem('${KEY}')==='dark');}catch(e){}})();`;

function read(): ThemeChoice {
  try {
    return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>("light");
  useEffect(() => setChoiceState(read()), []);
  const dark = choice === "dark";

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
