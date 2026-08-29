"use client";

import { useEffect, useState } from "react";
import { applyTheme, readTheme, type Theme } from "@/lib/theme";

const options = [
  ["dark", "Dark"],
  ["light", "Light"],
] as const;

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === "undefined" ? "dark" : readTheme(),
  );

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}

export function ThemeToggle() {
  const theme = useTheme();

  return (
    <div aria-label="Color theme" className="theme-toggle" role="group">
      {options.map(([value, label]) => (
        <button
          aria-pressed={theme === value}
          key={value}
          onClick={() => applyTheme(value)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
