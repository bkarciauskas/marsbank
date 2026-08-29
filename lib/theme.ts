export type Theme = "dark" | "light";

export const themeStorageKey = "marsbank-theme";

export function isTheme(value: string | null): value is Theme {
  return value === "dark" || value === "light";
}

export function readTheme(): Theme {
  if (typeof document === "undefined") {
    return "dark";
  }
  const fromDocument = document.documentElement.getAttribute("data-theme");
  return isTheme(fromDocument) ? fromDocument : "dark";
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem(themeStorageKey, theme);
}

export const themeInitScript = `(function(){try{var k=${JSON.stringify(themeStorageKey)};var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"){t="dark";}document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.setAttribute("data-theme","dark");document.documentElement.style.colorScheme="dark";}})();`;
