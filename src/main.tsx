import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./global.css";
import { ThemeProvider } from "./theme-provider";
import { AuthProvider } from "./contexts/AuthContext";
import { AdvancedSettingsPage } from "./components/advanced/AdvancedSettingsPage";
import { ProfilePage } from "./components/profile/ProfilePage";
import { LoginPage } from "./components/auth/LoginPage";
import { Auth } from "./routes/Auth";

const isSettingsRoute = () => {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  return path.startsWith("/settings") || hash.startsWith("#/settings");
};

const isAuthRoute = () => {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  return path.startsWith("/auth") || hash.startsWith("#/auth");
};

const isProfileRoute = () => {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  return path.startsWith("/profile") || hash.startsWith("#/profile");
};

const isLoginRoute = () => {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  return path.startsWith("/login") || hash.startsWith("#/login");
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        {isSettingsRoute() ? (
          <AdvancedSettingsPage />
        ) : isAuthRoute() ? (
          <Auth />
        ) : isProfileRoute() ? (
          <ProfilePage />
        ) : isLoginRoute() ? (
          <LoginPage />
        ) : (
          <App />
        )}
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
