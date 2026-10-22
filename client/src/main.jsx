import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/ibm-plex-sans";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { BillingProvider } from "./context/BillingContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <BillingProvider>
            <App />
          </BillingProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);

// The opening screen (in index.html) fades out once the app is drawn and its short animation has played.
const splash = document.getElementById("splash");
if (splash) {
  const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const played = Date.now() - (window.__splashAt || 0);
  setTimeout(() => {
    splash.classList.add("is-leaving");
    setTimeout(() => splash.remove(), 400);
  }, Math.max(0, (calm ? 0 : 1000) - played));
}
