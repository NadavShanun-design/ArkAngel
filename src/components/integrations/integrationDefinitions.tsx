import React from "react";
import {
  SiSlack,
  SiNotion,
  SiGmail,
  SiGooglecalendar,
  SiLinear,
  SiGoogle,
  SiGithub,
  SiGoogledocs,
  SiGoogleslides,
  SiGooglesheets,
} from "react-icons/si";
import { Mail } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentUserId } from "@/lib/user-helper";

// Google brand blue
const GOOGLE_BRAND_COLOR = "#4285F4";

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  // Whether the integration can actually connect yet
  isAvailable: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  connectMessage: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

// Helper function to create Google Suite integration
export const createGoogleSuiteIntegration = (): Integration => ({
  id: "google-suite",
  name: "Google Suite",
  description: "Authorize access to your Gmail and Calendar",
  icon: React.createElement(SiGoogle, { className: "h-5 w-5", style: { color: GOOGLE_BRAND_COLOR } }),
  isAvailable: true,
  isConnected: false,
  isConnecting: false,
  connectMessage: null,
  connect: async () => {
    try {
      await invoke<string>("connect_google_suite");
      console.log('[Integrations][Google] Connect successful');
    } catch (e: any) {
      console.error('[Integrations][Google] Connect error:', e);
      throw e;
    }
  },
  disconnect: async () => {
    try {
      await invoke<string>("disconnect_google_suite");
      console.log('[Integrations][Google] Disconnect successful');
    } catch (e: any) {
      console.error('[Integrations][Google] Disconnect error:', e);
      throw e;
    }
  }
});

// Helper function to check Google connection status
export const checkGoogleConnectionStatus = async (): Promise<boolean> => {
  try {
    const connected = await invoke<boolean>("is_google_connected");
    return Boolean(connected);
  } catch (err) {
    console.error('[Integrations][Google] Failed to check connection status:', err);
    return false;
  }
};

// Generic helper to create a stub (UI-only) integration
const createStubIntegration = (
  id: string,
  name: string,
  description: string,
  icon: React.ReactNode
): Integration => ({
  id,
  name,
  description,
  icon,
  isAvailable: false,
  isConnected: false,
  isConnecting: false,
  connectMessage: "Coming soon",
  connect: async () => {
    // UI-only for now
    return Promise.reject(new Error("Coming soon"));
  },
  disconnect: async () => {
    // UI-only for now
    return Promise.resolve();
  },
});

// Helper to create a real Composio-powered integration
const createComposioIntegration = (
  id: string,
  composioAppName: string,
  displayName: string,
  description: string,
  icon: React.ReactNode
): Integration => ({
  id,
  name: displayName,
  description,
  icon,
  isAvailable: true, // Composio integrations are available
  isConnected: false, // Will be updated dynamically
  isConnecting: false,
  connectMessage: null,
  connect: async () => {
    try {
      const userId = getCurrentUserId();
      const response = await fetch('http://127.0.0.1:8765/api/integrations/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: composioAppName,
          userId: userId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to connect: ${response.statusText}`);
      }

      const { redirectUrl } = await response.json();

      // Open OAuth window
      console.log(`[Integrations] Opening OAuth window for ${composioAppName}:`, redirectUrl);
      window.open(redirectUrl, '_blank', 'width=600,height=700');
    } catch (error: any) {
      console.error(`[Integrations] Connect error for ${composioAppName}:`, error);
      throw error;
    }
  },
  disconnect: async () => {
    try {
      const userId = getCurrentUserId();
      const response = await fetch('http://127.0.0.1:8765/api/integrations/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: composioAppName,
          userId: userId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to disconnect: ${response.statusText}`);
      }

      console.log(`[Integrations] Successfully disconnected ${composioAppName}`);
    } catch (error: any) {
      console.error(`[Integrations] Disconnect error for ${composioAppName}:`, error);
      throw error;
    }
  }
});

// Individual integrations - Now powered by Composio!
export const createSlackIntegration = (): Integration =>
  createComposioIntegration(
    "slack",
    "SLACK",
    "Slack",
    "Send messages, manage channels, and collaborate with your team",
    React.createElement(SiSlack, { className: "h-5 w-5 text-[#611f69]" })
  );

export const createNotionIntegration = (): Integration =>
  createComposioIntegration(
    "notion",
    "NOTION",
    "Notion",
    "Create pages, update databases, and manage your workspace",
    React.createElement(SiNotion, { className: "h-5 w-5 text-black dark:text-white" })
  );

export const createOutlookIntegration = (): Integration =>
  createStubIntegration(
    "outlook",
    "Outlook",
    "Connect your Outlook account",
    React.createElement(Mail, { className: "h-5 w-5 text-[#0078D4]" })
  );

export const createGmailIntegration = (): Integration =>
  createStubIntegration(
    "gmail",
    "Gmail",
    "Connect your Gmail account",
    React.createElement(SiGmail, { className: "h-5 w-5 text-[#EA4335]" })
  );

export const createGoogleCalendarIntegration = (): Integration =>
  createStubIntegration(
    "google-calendar",
    "Google Calendar",
    "Connect your Google Calendar",
    React.createElement(SiGooglecalendar, { className: "h-5 w-5 text-[#4285F4]" })
  );

export const createLinearIntegration = (): Integration =>
  createComposioIntegration(
    "linear",
    "LINEAR",
    "Linear",
    "Create issues, update tasks, and manage your project workflow",
    React.createElement(SiLinear, { className: "h-5 w-5 text-[#5E6AD2]" })
  );

export const createGithubIntegration = (): Integration =>
  createComposioIntegration(
    "github",
    "GITHUB",
    "GitHub",
    "Manage repositories, create issues, and interact with pull requests",
    React.createElement(SiGithub, { className: "h-5 w-5 text-black dark:text-white" })
  );

export const createLoopsIntegration = (): Integration =>
  createStubIntegration(
    "loops",
    "Loops",
    "Connect your Loops account",
    // Loops brand color (approx purple); replace with official if available
    React.createElement(SiLinear, { className: "h-5 w-5 text-[#6E56CF]" })
  );

export const createGoogleDocsIntegration = (): Integration =>
  createStubIntegration(
    "google-docs",
    "Google Docs",
    "Connect your Google Docs",
    React.createElement(SiGoogledocs, { className: "h-5 w-5 text-[#4285F4]" })
  );

export const createGoogleSlidesIntegration = (): Integration =>
  createStubIntegration(
    "google-slides",
    "Google Slides",
    "Connect your Google Slides",
    React.createElement(SiGoogleslides, { className: "h-5 w-5 text-[#FBBC04]" })
  );

export const createGoogleSheetsIntegration = (): Integration =>
  createStubIntegration(
    "google-sheets",
    "Google Sheets",
    "Connect your Google Sheets",
    React.createElement(SiGooglesheets, { className: "h-5 w-5 text-[#34A853]" })
  );

// Function to get all available integrations
export const getAvailableIntegrations = async (): Promise<Integration[]> => {
  const integrations: Integration[] = [];

  // Add Google Suite integration (real connection)
  const googleIntegration = createGoogleSuiteIntegration();
  googleIntegration.isConnected = await checkGoogleConnectionStatus();
  integrations.push(googleIntegration);

  // UI-only integrations (coming soon)
  integrations.push(
    createSlackIntegration(),
    createNotionIntegration(),
    createOutlookIntegration(),
    createGmailIntegration(),
    createGoogleCalendarIntegration(),
    createLinearIntegration(),
    createGithubIntegration(),
    createLoopsIntegration(),
    createGoogleDocsIntegration(),
    createGoogleSlidesIntegration(),
    createGoogleSheetsIntegration()
  );

  return integrations;
};