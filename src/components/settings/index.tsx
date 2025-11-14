import { useState, useEffect } from "react";
import { useWindowResize } from "@/hooks";
import { SettingsIcon, User, LogOut } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger, Button, ScrollArea, SpotlightArea } from "@/components";
import { ProviderSelection } from "./ProviderSelection";
import { ThemeToggle } from "./ThemeToggle";
import { ApiKeyInput } from "./ApiKeyInput";
import { ModelSelection } from "./ModelSelection";
import { Disclaimer } from "./Disclaimer";
import { Speech } from "./Speech";
import { FileUploadSettings } from "./FileUploadSettings";
import { TauriFileUpload } from "./TauriFileUpload";
import {
  loadSettingsFromStorage,
  saveSettingsToStorage,
  fetchModels,
  getProviderById,
} from "@/lib";
import { findPersonaById } from "@/lib/personas";
import { SettingsState } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import { openUrl as openExternalUrl } from "@tauri-apps/plugin-opener";
import { useAuth } from "@/contexts/AuthContext";
interface SettingsProps {
  onOpenIntegrations?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onOpenIntegrations }) => {
  const [settings, setSettings] = useState<SettingsState>(
    loadSettingsFromStorage
  );
  const { resizeWindow } = useWindowResize();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();

  // Save to localStorage whenever settings change
  useEffect(() => {
    saveSettingsToStorage(settings);
  }, [settings]);

  // Check for updates
  useEffect(() => {
    const check = async () => {
      try {
        console.log('[Settings][Google] Checking connection status...')
        const connected = await invoke<boolean>("is_google_connected");
        console.log('[Settings][Google] Status response:', connected)
        // Note: Google connection status is now handled in the Integrations component
      } catch (err) {
        console.error('[Settings][Google] Failed to check connection status:', err)
      }
    };
    check();
  }, [isPopoverOpen]);

  const updateSettings = (updates: Partial<SettingsState>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  const handleApiKeySubmit = async () => {
    if (!settings.apiKey.trim()) return;

    const provider = getProviderById(settings.selectedProvider);
    if (!provider) return;

    // Mark API key as submitted first
    updateSettings({
      isApiKeySubmitted: true,
      isLoadingModels: false,
      modelsFetchError: null,
      availableModels: [],
    });

    // Try to fetch models if provider supports it (custom providers don't have models endpoint)
    if (provider.models && !provider.isCustom) {
      updateSettings({ isLoadingModels: true });

      try {
        const models = await fetchModels(provider, settings.apiKey.trim());
        updateSettings({
          isLoadingModels: false,
          availableModels: models,
          modelsFetchError: null,
          // Clear selected model if it's not in the fetched models
          selectedModel: models.includes(settings.selectedModel)
            ? settings.selectedModel
            : "",
        });
      } catch (error) {
        updateSettings({
          isLoadingModels: false,
          modelsFetchError:
            error instanceof Error ? error.message : "Failed to fetch models",
          availableModels: [],
        });
      }
    } else if (
      provider.isCustom &&
      provider.defaultModel &&
      !settings.customModel
    ) {
      // For custom providers, auto-fill the default model if none is set
      updateSettings({
        customModel: provider.defaultModel,
      });
    }
  };

  const handleApiKeyDelete = () => {
    updateSettings({
      apiKey: "",
      isApiKeySubmitted: false,
      selectedModel: "",
      customModel: "",
      availableModels: [],
      isLoadingModels: false,
      modelsFetchError: null,
    });
  };

  const handleOpenAiApiKeySubmit = () => {
    if (!settings.openAiApiKey.trim()) return;
    updateSettings({
      isOpenAiApiKeySubmitted: true,
    });
  };

  const handleOpenAiApiKeyDelete = () => {
    updateSettings({
      openAiApiKey: "",
      isOpenAiApiKeySubmitted: false,
    });
  };

  const handleOpenAiKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleOpenAiApiKeySubmit();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleApiKeySubmit();
    }
  };

  const currentProvider = getProviderById(settings.selectedProvider);

  useEffect(() => {
    resizeWindow(isPopoverOpen);
  }, [isPopoverOpen, resizeWindow]);

  const openAdvancedInBrowser = async () => {
    // Open advanced settings in a new Tauri window
    try {
      await invoke('open_settings_window');
    } catch (error) {
      console.error('Failed to open settings window:', error);
      // Fallback: try opening in external browser
      try {
        const origin = window.location.origin;
        const target = origin.startsWith("http") ? `${origin}/settings` : "https://www.arkangel.com/settings";
        openExternalUrl(target).catch(() => {
          window.open(target, "_blank", "noopener,noreferrer");
        });
      } catch {
        const origin = window.location.origin;
        const target = origin.startsWith("http") ? `${origin}/settings` : "https://www.arkangel.com/settings";
        window.open(target, "_blank", "noopener,noreferrer");
      }
    }
  };

  const handleAuthClick = async () => {
    try {
      await invoke('open_auth_window');
    } catch (error) {
      console.error('Failed to open auth window:', error);
    }
  };

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          aria-label="Open Settings"
          className="cursor-pointer [data-state=open]:bg-[red]"
          spotlight={true}
          title="Open Settings"
        >
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>

      {/* Settings Panel */}
      <PopoverContent
        align="end"
        side="bottom"
        className="select-none w-screen p-0 border overflow-hidden border-input/50"
        sideOffset={8}
      >
        <ScrollArea className="h-[calc(100vh-6.5rem)]">
          <div className="p-6 space-y-4">
            {/* Configuration Header */}
            <div className="border-b border-input/50 pb-2">
              <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                AI Configuration
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Configure your AI provider, authentication, and model
                preferences for the best experience.
              </p>
            </div>

            {/* Integrations */}
            <SpotlightArea className="flex items-center justify-between gap-2 p-3 rounded-md border border-input/50 bg-background/50">
              <div className="text-sm">
                <div className="font-medium">Integrations</div>
                <div className="text-xs text-muted-foreground">Manage your third-party integrations</div>
              </div>
              <Button
                onClick={() => {
                  setIsPopoverOpen(false);
                  onOpenIntegrations?.();
                }}
                size="sm"
                variant="secondary"
              >
                Open Integrations
              </Button>
            </SpotlightArea>

            {/* Manage Data */}
            <SpotlightArea className="flex items-center justify-between gap-2 p-3 rounded-md border border-input/50 bg-background/50">
              <div className="text-sm">
                <div className="font-medium">Manage Data</div>
                <div className="text-xs text-muted-foreground">Manage your uploaded files and chat history</div>
              </div>
              <Button
                onClick={() => { /* no-op for now */ }}
                size="sm"
                variant="secondary"
              >
                View Data
              </Button>
            </SpotlightArea>

            {/** Advanced settings access moved to bottom link */}

            {/* Theme Toggle (in-app only) */}
            <ThemeToggle />

            {/* AI Provider Selection */}
            <ProviderSelection
              value={settings.selectedProvider}
              onChange={(value) => {
                const selectedProvider = getProviderById(value);
                const defaultModel = selectedProvider?.isCustom
                  ? selectedProvider.defaultModel || ""
                  : "";

                updateSettings({
                  selectedProvider: value,
                  apiKey: "",
                  isApiKeySubmitted: false,
                  selectedModel: "",
                  customModel: defaultModel,
                  availableModels: [],
                  isLoadingModels: false,
                  modelsFetchError: null,
                });
              }}
            />

            {/* API Key Configuration */}
            <ApiKeyInput
              providerName={currentProvider?.name || ""}
              value={settings.apiKey}
              onChange={(value) => updateSettings({ apiKey: value })}
              onSubmit={handleApiKeySubmit}
              onDelete={handleApiKeyDelete}
              onKeyPress={handleKeyPress}
              isSubmitted={settings.isApiKeySubmitted}
            />

            {/* Model Selection */}
            <ModelSelection
              provider={settings.selectedProvider}
              selectedModel={settings.selectedModel}
              customModel={settings.customModel}
              onModelChange={(value) =>
                updateSettings({
                  selectedModel: value.replace("models/", ""),
                })
              }
              onCustomModelChange={(value) =>
                updateSettings({ customModel: value })
              }
              disabled={!settings.isApiKeySubmitted}
              availableModels={settings.availableModels}
              isLoadingModels={settings.isLoadingModels}
              modelsFetchError={settings.modelsFetchError}
            />

            {/* Speech-to-Text Configuration (only show for non-OpenAI providers) */}
            {settings.selectedProvider &&
              settings.selectedProvider !== "openai" && (
                <Speech
                  value={settings.openAiApiKey}
                  onChange={(value) => updateSettings({ openAiApiKey: value })}
                  onSubmit={handleOpenAiApiKeySubmit}
                  onDelete={handleOpenAiApiKeyDelete}
                  onKeyPress={handleOpenAiKeyPress}
                  isSubmitted={settings.isOpenAiApiKeySubmitted}
                />
              )}

            {/* User Profile */}
            <div className="space-y-2">
              <div>
                <label className="text-sm font-semibold">Profile & Account</label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Manage your personal information and account settings.
                </p>
              </div>
              <SpotlightArea className="p-3 rounded-md border border-input/50 bg-background/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-black to-gray-600 dark:from-white dark:to-gray-300 flex items-center justify-center">
                      <span className="text-white dark:text-black text-xs font-medium">U</span>
                    </div>
                    <div>
                      <div className="font-medium text-sm">User Profile</div>
                      <div className="text-xs text-muted-foreground">
                        View and edit your personal information
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsPopoverOpen(false);
                      // Open advanced settings page instead of profile page
                      openAdvancedInBrowser();
                    }}
                    className="text-xs"
                  >
                    View Personal Information
                  </Button>
                </div>
              </SpotlightArea>
            </div>

            {/* Angel Persona */}
            <div className="space-y-2">
              <div>
                <label className="text-sm font-semibold">Angel Persona</label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Current AI personality and behavior style.
                </p>
              </div>
              <SpotlightArea className="p-3 rounded-md border border-input/50 bg-background/50">
                {(() => {
                  const activePersona = findPersonaById(settings.personas || [], settings.currentPersonaId || "");
                  if (!activePersona) {
                    return (
                      <div className="text-sm text-muted-foreground">
                        No persona selected
                      </div>
                    );
                  }
                  return (
                    <div>
                      <div className="font-medium text-sm mb-1">{activePersona.name}</div>
                      <div className="text-xs text-muted-foreground mb-2">
                        {activePersona.summary}
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => { 
                          e.preventDefault(); 
                          setIsPopoverOpen(false); 
                          openAdvancedInBrowser();
                        }}
                        className="text-xs"
                      >
                        Manage Personas
                      </Button>
                    </div>
                  );
                })()}
              </SpotlightArea>
            </div>

            {/* Document Upload Section */}
            <div className="space-y-3">
              <div className="space-y-1">
                <h4 className="text-sm font-medium">Your Documents</h4>
                <p className="text-xs text-muted-foreground">
                  Upload documents to provide context for AI conversations. Documents are automatically summarized and included in every conversation.
                </p>
              </div>
              
              {/* Upload Button */}
              <TauriFileUpload />
              
              {/* Existing File List */}
              <FileUploadSettings showHeader={false} />
            </div>
          </div>

          <div className="pb-2 flex items-center justify-center">
            <a
              href="/settings"
              onClick={(e) => { e.preventDefault(); setIsPopoverOpen(false); openAdvancedInBrowser(); }}
              className="text-sm text-muted-foreground text-center font-medium underline underline-offset-2"
              rel="noopener noreferrer"
            >
              Advanced Settings
            </a>
          </div>
          <div className="pb-4 flex items-center justify-center">
            <a
              href="https://www.arkangel.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground text-center font-medium"
            >
              ArkAngel
            </a>
          </div>
        </ScrollArea>

        {/* Auth footer row */}
        <div className="border-t border-input/50 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-foreground">
              {isAuthenticated ? (
                user?.is_guest ? 'Welcome, Guest' : `Welcome, ${user?.full_name || 'User'}`
              ) : (
                'Welcome'
              )}
            </div>
            <div className="flex gap-2">
              {isAuthenticated ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async (e) => {
                    console.log('[Settings] ===== SIGN OUT BUTTON CLICKED =====');
                    console.log('[Settings] Event:', e);
                    console.log('[Settings] isAuthenticated:', isAuthenticated);
                    console.log('[Settings] user:', user);

                    // Prevent any default behavior
                    e.preventDefault();
                    e.stopPropagation();

                    try {
                      console.log('[Settings] Starting logout process...');
                      console.log('[Settings] Calling logout() function...');

                      await logout();

                      console.log('[Settings] ===== LOGOUT COMPLETED SUCCESSFULLY =====');
                    } catch (error) {
                      console.error('[Settings] ===== LOGOUT ERROR =====');
                      console.error('[Settings] Error object:', error);
                      console.error('[Settings] Error message:', (error as any).message);
                      console.error('[Settings] Error stack:', (error as any).stack);

                      // Show alert to user
                      const errorMsg = (error as any).message || 'Unknown error';
                      alert(`Failed to logout: ${errorMsg}\n\nCheck browser console for details.`);
                    }
                  }}
                  className="text-xs"
                >
                  <LogOut className="h-3 w-3 mr-1" />
                  Sign Out
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAuthClick}
                    className="text-xs"
                  >
                    <User className="h-3 w-3 mr-1" />
                    Sign In
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleAuthClick}
                    className="text-xs"
                  >
                    Sign Up
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-input/50">
          <Disclaimer />
        </div>
      </PopoverContent>
    </Popover>
  );
};

