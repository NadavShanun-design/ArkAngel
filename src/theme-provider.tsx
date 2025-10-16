import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { STORAGE_KEYS } from "@/config/";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = STORAGE_KEYS.THEME,
  ...props
}: Readonly<ThemeProviderProps>) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const isSystemThemeDark = mediaQuery.matches;

  useEffect(() => {
    // Initialize design data attributes from localStorage
    try {
      const root = window.document.documentElement;
      let accent = (localStorage.getItem(STORAGE_KEYS.DESIGN_ACCENT) as string) || "bw";
      let gradient = (localStorage.getItem(STORAGE_KEYS.DESIGN_GRADIENT) as string) || "bw";
      // Persist defaults if missing so new users have consistent state
      if (!localStorage.getItem(STORAGE_KEYS.DESIGN_ACCENT)) {
        localStorage.setItem(STORAGE_KEYS.DESIGN_ACCENT, accent);
      }
      if (!localStorage.getItem(STORAGE_KEYS.DESIGN_GRADIENT)) {
        localStorage.setItem(STORAGE_KEYS.DESIGN_GRADIENT, gradient);
      }
      root.dataset.accent = accent;
      root.dataset.gradient = gradient;
    } catch {}
  }, []);

  // Cross-window sync for design settings and theme
  useEffect(() => {
    let ch: BroadcastChannel | null = null;
    const pollIdRef = { current: 0 as number | null };
    let lastAccent = localStorage.getItem(STORAGE_KEYS.DESIGN_ACCENT) || "bw";
    let lastGradient = localStorage.getItem(STORAGE_KEYS.DESIGN_GRADIENT) || "bw";
    let lastTheme = (localStorage.getItem(storageKey) as Theme) || "system";
    let evtSrc: EventSource | null = null;
    let sseConnected = false;

    try {
      ch = new BroadcastChannel("arkangel-design");
      ch.onmessage = (e: MessageEvent) => {
        try {
          const root = window.document.documentElement;
          if (e.data?.type === "accent") {
            localStorage.setItem(STORAGE_KEYS.DESIGN_ACCENT, e.data.value);
            root.dataset.accent = e.data.value;
            lastAccent = e.data.value;
          }
          if (e.data?.type === "gradient") {
            localStorage.setItem(STORAGE_KEYS.DESIGN_GRADIENT, e.data.value);
            root.dataset.gradient = e.data.value;
            lastGradient = e.data.value;
          }
          if (e.data?.type === "theme") {
            const newTheme = e.data.value as Theme;
            localStorage.setItem(storageKey, newTheme);
            setTheme(newTheme);
            lastTheme = newTheme;
          }
        } catch {}
      };
    } catch {}

    const onStorage = (ev: StorageEvent) => {
      try {
        const root = window.document.documentElement;
        if (ev.key === STORAGE_KEYS.DESIGN_ACCENT && ev.newValue) {
          root.dataset.accent = ev.newValue;
          lastAccent = ev.newValue;
        }
        if (ev.key === STORAGE_KEYS.DESIGN_GRADIENT && ev.newValue) {
          root.dataset.gradient = ev.newValue;
          lastGradient = ev.newValue;
        }
        if (ev.key === storageKey && ev.newValue) {
          const newTheme = ev.newValue as Theme;
          setTheme(newTheme);
          lastTheme = newTheme;
        }
      } catch {}
    };
    window.addEventListener("storage", onStorage);

    const ensurePolling = () => {
      if (sseConnected) return; // don't poll when SSE is connected
      if (pollIdRef.current) return;
      pollIdRef.current = window.setInterval(() => {
      try {
        const a = localStorage.getItem(STORAGE_KEYS.DESIGN_ACCENT) || "bw";
        const g = localStorage.getItem(STORAGE_KEYS.DESIGN_GRADIENT) || "bw";
        const t = (localStorage.getItem(storageKey) as Theme) || "system";
        const root = window.document.documentElement;
        if (a !== lastAccent) { root.dataset.accent = a; lastAccent = a; }
        if (g !== lastGradient) { root.dataset.gradient = g; lastGradient = g; }
        if (t !== lastTheme) { setTheme(t); lastTheme = t; }
      } catch {}
      }, 1200) as unknown as number;
    };
    ensurePolling();

    // Subscribe to local sidecar SSE for out-of-app browser changes
    try {
      const tryStart = (base: string) => {
        try {
          const es = new EventSource(`${base}/design/events`);
          es.onmessage = (ev) => {
            try {
              const data = JSON.parse(ev.data || '{}');
              const root = window.document.documentElement;
              if (data.accent && (data.accent === 'bw' || data.accent === 'rainbow')) {
                localStorage.setItem(STORAGE_KEYS.DESIGN_ACCENT, data.accent);
                root.dataset.accent = data.accent;
                lastAccent = data.accent;
              }
              if (data.gradient && (data.gradient === 'bw' || data.gradient === 'rainbow')) {
                localStorage.setItem(STORAGE_KEYS.DESIGN_GRADIENT, data.gradient);
                root.dataset.gradient = data.gradient;
                lastGradient = data.gradient;
              }
              if (data.theme && (data.theme === 'light' || data.theme === 'dark' || data.theme === 'system')) {
                localStorage.setItem(storageKey, data.theme);
                setTheme(data.theme as Theme);
                lastTheme = data.theme as Theme;
              }
              if (!sseConnected) {
                sseConnected = true;
                if (pollIdRef.current) { window.clearInterval(pollIdRef.current as unknown as number); pollIdRef.current = 0 as any; }
              }
            } catch {}
          };
          es.onerror = () => {
            sseConnected = false;
            try { es.close(); } catch {}
            ensurePolling();
          };
          evtSrc = es;
        } catch {}
      };
      tryStart('http://127.0.0.1:8765');
      if (!evtSrc) tryStart('http://localhost:8765');
    } catch {}

    return () => {
      try { ch?.close(); } catch {}
      window.removeEventListener("storage", onStorage);
      if (pollIdRef.current) { window.clearInterval(pollIdRef.current as unknown as number); pollIdRef.current = 0 as any; }
      try { evtSrc?.close(); } catch {}
    };
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = (currentTheme: Theme) => {
      root.classList.remove("light", "dark");

      if (currentTheme === "system") {
        const systemTheme = mediaQuery.matches ? "dark" : "light";
        root.classList.add(systemTheme);
      } else {
        root.classList.add(currentTheme);
      }
    };

    const updateTheme = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };

    applyTheme(theme);

    if (theme === "system") {
      mediaQuery.addEventListener("change", updateTheme);
    }

    return () => {
      if (theme === "system") {
        mediaQuery.removeEventListener("change", updateTheme);
      }
    };
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    setTheme: (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme);
      setTheme(newTheme);
    },
    isSystemThemeDark,
  }), [theme, storageKey, isSystemThemeDark]);

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
