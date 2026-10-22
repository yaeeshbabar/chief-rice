import { createContext, useContext, useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "crt_theme";
const ThemeContext = createContext(null);

const getInitial = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitial);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
    // The phone's status bar takes the colour of the app's top bar
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#111a2c" : "#ffffff");
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
