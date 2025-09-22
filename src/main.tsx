import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./global.css";
import { ThemeProvider } from "./theme-provider";
import { AdvancedSettingsPage } from "./components/advanced/AdvancedSettingsPage";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      {typeof window !== "undefined" && window.location.pathname.startsWith("/settings") ? (
        <AdvancedSettingsPage />
      ) : (
        <App />
      )}
    </ThemeProvider>
  </React.StrictMode>
);
