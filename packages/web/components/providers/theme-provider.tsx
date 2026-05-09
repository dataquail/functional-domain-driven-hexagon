"use client";

import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as React from "react";

const Theme = Schema.Literal("dark", "light", "system");
type Theme = typeof Theme.Type;

const ActualTheme = Schema.Literal("dark", "light");
type ActualTheme = typeof ActualTheme.Type;

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  actualTheme: ActualTheme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  actualTheme: "light",
  setTheme: () => null,
};

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState);

export const ThemeProvider = ({
  children,
  defaultTheme = "system",
  storageKey = "web-ui-theme",
  ...props
}: ThemeProviderProps) => {
  // SSR-safe: useState initializer runs on the server with no
  // localStorage available, so we fall back to defaultTheme there.
  // The first client render reconciles with localStorage via the
  // effect below — minor flash of unstyled theme is acceptable for
  // a template, and the recommended fix (an inline blocking script
  // that sets the html class before hydration) is left as a Phase 6
  // polish item.
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);

  React.useEffect(() => {
    const stored = Option.fromNullable(window.localStorage.getItem(storageKey)).pipe(
      Option.flatMap(Schema.decodeUnknownOption(Theme)),
    );
    if (Option.isSome(stored)) setThemeState(stored.value);
  }, [storageKey]);

  const actualTheme = React.useMemo<ActualTheme>(() => {
    if (typeof window === "undefined") return "light";
    if (theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return theme;
  }, [theme]);

  React.useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(actualTheme);
  }, [actualTheme]);

  const value = {
    theme,
    actualTheme,
    setTheme: (next: Theme) => {
      window.localStorage.setItem(storageKey, next);
      setThemeState(next);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
};

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext);

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
