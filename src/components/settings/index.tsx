import { useState, useEffect } from "react";
import { useWindowResize } from "@/hooks";
import { SettingsIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger, Button, ScrollArea, SpotlightArea } from "@/components";
import { ProviderSelection } from "./ProviderSelection";
import { ApiKeyInput } from "./ApiKeyInput";
import { ModelSelection } from "./ModelSelection";
import { Disclaimer } from "./Disclaimer";
import { SystemPrompt } from "./SystemPrompt";
import { Speech } from "./Speech";
import { ManageDataDialog } from "./ManageDataDialog";
import { ThemeToggle } from "./ThemeToggle";
import {
  loadSettingsFromStorage,
  saveSettingsToStorage,
  fetchModels,
  getProviderById,
} from "@/lib";
import { SettingsState } from "@/types";
import { invoke } from "@tauri-apps/api/core";
interface SettingsProps {
  onOpenIntegrations?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onOpenIntegrations }) => {
  const [settings, setSettings] = useState<SettingsState>(
    loadSettingsFromStorage
  );
  const { resizeWindow } = useWindowResize();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

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

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          aria-label="Open Settings"
          className="cursor-pointer [data-state=open]:bg-[red]"
          spotlight
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

            {/* Theme Toggle */}
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

            {/* System Prompt */}
            <SystemPrompt
              value={settings.systemPrompt}
              onChange={(value) => updateSettings({ systemPrompt: value })}
            />

            {/* Manage Data (pop-out dialog) */}
            <SpotlightArea className="flex items-center justify-between gap-2 p-3 rounded-md border border-input/50 bg-background/50">
              <div className="text-sm">
                <div className="font-medium">Manage Data</div>
                <div className="text-xs text-muted-foreground">View and delete uploaded files and chat history</div>
              </div>
              <ManageDataDialog />
            </SpotlightArea>
          </div>

          <div className="pb-4 flex items-center justify-center">
            <a
              href="https://www.srikanthnani.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground text-center font-medium"
            >
              ArkAngel
            </a>
          </div>
        </ScrollArea>

        <div className="border-t border-input/50">
          <Disclaimer />
        </div>
      </PopoverContent>
    </Popover>
  );
};
