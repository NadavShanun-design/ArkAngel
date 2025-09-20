import { useState, useEffect, useRef } from "react";
import { useWindowResize } from "@/hooks";
import { useCompletionShared } from "@/contexts/CompletionScope";
import { isSupportedFileType } from "@/lib/files";
import { SettingsIcon, UploadIcon, FileIcon, XIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
  ScrollArea,
} from "@/components";
import { ProviderSelection } from "./ProviderSelection";
import { ApiKeyInput } from "./ApiKeyInput";
import { ModelSelection } from "./ModelSelection";
import { Disclaimer } from "./Disclaimer";
import { SystemPrompt } from "./SystemPrompt";
import { Speech } from "./Speech";
import {
  loadSettingsFromStorage,
  saveSettingsToStorage,
  fetchModels,
  getProviderById,
} from "@/lib";
import { SettingsState } from "@/types";
import { invoke } from "@tauri-apps/api/core";
export const Settings = () => {
  const [settings, setSettings] = useState<SettingsState>(
    loadSettingsFromStorage
  );
  const { resizeWindow } = useWindowResize();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  // Document upload functionality
  const { /* addFile, */ attachedFiles, /* removeFile */ } = useCompletionShared();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [googleConnectMessage, setGoogleConnectMessage] = useState<string | null>(null);
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(false);

  // Component mount logging
  useEffect(() => {
    console.log('🔥 [SETTINGS] Component mounted');
    loadUploadedFiles();
  }, []);

  // Load files from Rust backend
  const loadUploadedFiles = async () => {
    try {
      setIsLoadingFiles(true);
      const files = await invoke<any[]>('list_uploaded_files');
      setUploadedFiles(files);
      console.log('[SETTINGS] Loaded files from Rust backend:', files);
    } catch (error) {
      console.error('[SETTINGS] Failed to load files:', error);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Delete file from Rust backend
  const deleteFile = async (fileId: string) => {
    try {
      await invoke('delete_uploaded_file', { fileId });
      console.log('[SETTINGS] Deleted file:', fileId);
      await loadUploadedFiles(); // Reload the list
      
      // Notify completion component to refresh file count
      window.dispatchEvent(new CustomEvent('fileDeleted'));
    } catch (error) {
      console.error('[SETTINGS] Failed to delete file:', error);
    }
  };

  // Toggle file context
  const toggleFileContext = async (fileId: string, enabled: boolean) => {
    try {
      await invoke('toggle_file_context', { fileId, enabled });
      console.log('[SETTINGS] Toggled file context:', fileId, enabled);
      await loadUploadedFiles(); // Reload the list
    } catch (error) {
      console.error('[SETTINGS] Failed to toggle file context:', error);
    }
  };

  // Save to localStorage whenever settings change
  useEffect(() => {
    saveSettingsToStorage(settings);
  }, [settings]);

  // Function to check Google OAuth status from sidecar
  const checkGoogleStatusFromSidecar = async (): Promise<boolean> => {
    try {
      console.log('🔥 [GOOGLE_STATUS] Checking Google status from sidecar...');
      console.log('🔥 [GOOGLE_STATUS] Fetching from: http://127.0.0.1:8765/api/google/status');
      
      const response = await fetch('http://127.0.0.1:8765/api/google/status');
      console.log('🔥 [GOOGLE_STATUS] Response status:', response.status);
      console.log('🔥 [GOOGLE_STATUS] Response ok:', response.ok);
      
      if (response.ok) {
        const status = await response.json();
        console.log('🔥 [GOOGLE_STATUS] Response data:', status);
        console.log('🔥 [GOOGLE_STATUS] Connected status:', status.connected);
        return status.connected || false;
      } else {
        console.log('🔥 [GOOGLE_STATUS] ❌ Response not ok:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('🔥 [GOOGLE_STATUS] ❌ Failed to check Google status:', error);
      console.error('🔥 [GOOGLE_STATUS] Error type:', typeof error);
      console.error('🔥 [GOOGLE_STATUS] Error message:', error);
    }
    return false;
  };

  // Check Google connection on mount/open
  useEffect(() => {
    const check = async () => {
      try {
        console.log('🔥 [SETTINGS] Popover opened, checking Google status...');
        
        // Always check sidecar for Google status - it's the authoritative source
        const connected = await checkGoogleStatusFromSidecar();
        console.log('🔥 [SETTINGS] Google connection status:', connected);
        setIsGoogleConnected(connected);
        
      } catch (error) {
        console.error('🔥 [SETTINGS] Error checking Google status:', error);
        setIsGoogleConnected(false);
      }
    };
    
    if (isPopoverOpen) {
      check();
    }
  }, [isPopoverOpen]);

  const updateSettings = (updates: Partial<SettingsState>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  };

  // File upload handlers
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    for (const file of files) {
      if (isSupportedFileType(file.type)) {
        try {
          // Convert file to byte array for Tauri IPC
          const fileData = await file.arrayBuffer();
          const bytes = Array.from(new Uint8Array(fileData));
          
          // Send to Rust backend via Tauri invoke
          await invoke('upload_file', {
            fileData: bytes,
            filename: file.name
          });
          
          console.log(`[SETTINGS] Successfully uploaded file: ${file.name}`);
        } catch (error) {
          console.error(`[SETTINGS] Failed to upload file ${file.name}:`, error);
        }
      }
    }
    
    // Reload the uploaded files list
    await loadUploadedFiles();
    
    // Notify completion component to refresh file count
    window.dispatchEvent(new CustomEvent('fileUploaded'));
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
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

  const handleOpenAiApiKeySubmit = async () => {
    if (!settings.openAiApiKey.trim()) return;

    const provider = getProviderById("openai");
    if (!provider) return;

    // Mark API key as submitted first
    updateSettings({
      isOpenAiApiKeySubmitted: true,
      isLoadingModels: false,
      modelsFetchError: null,
      availableModels: [],
    });

    // Try to fetch models if provider supports it
    if (provider.models && !provider.isCustom) {
      updateSettings({ isLoadingModels: true });

      try {
        const models = await fetchModels(provider, settings.openAiApiKey.trim());
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
    }
  };

  const handleOpenAiApiKeyDelete = () => {
    updateSettings({
      openAiApiKey: "",
      isOpenAiApiKeySubmitted: false,
      selectedModel: "",
      availableModels: [],
      isLoadingModels: false,
      modelsFetchError: null,
    });
  };

  const handleClaudeApiKeySubmit = async () => {
    if (!settings.claudeApiKey.trim()) return;

    const provider = getProviderById("claude");
    if (!provider) return;

    // Mark API key as submitted first
    updateSettings({
      isClaudeApiKeySubmitted: true,
      isLoadingModels: false,
      modelsFetchError: null,
      availableModels: [],
    });

    // Try to fetch models if provider supports it
    if (provider.models && !provider.isCustom) {
      updateSettings({ isLoadingModels: true });

      try {
        const models = await fetchModels(provider, settings.claudeApiKey.trim());
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
    }
  };

  const handleClaudeApiKeyDelete = () => {
    updateSettings({
      claudeApiKey: "",
      isClaudeApiKeySubmitted: false,
      selectedModel: "",
      availableModels: [],
      isLoadingModels: false,
      modelsFetchError: null,
    });
  };

  const handleOpenAiKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleOpenAiApiKeySubmit();
    }
  };

  const handleClaudeKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleClaudeApiKeySubmit();
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

  // Auto-close on focus loss disabled to prevent interruptions during form interactions
  // Settings should be closed manually via the toggle button for better UX
  // useWindowFocus({
  //   onFocusLost: () => {
  //     setIsPopoverOpen(false);
  //   },
  // });

  const handleConnectGoogle = async () => {
    console.log('🔥 [GOOGLE_CONNECT] ===== BUTTON CLICKED =====');
    
    try {
      setIsConnectingGoogle(true);
      setGoogleConnectMessage(null);
      
      // Use the sidecar endpoint instead of Tauri command for proper MCP integration
      console.log('🔥 [GOOGLE_CONNECT] Calling sidecar /api/google/connect endpoint...');
      
      const response = await fetch('http://127.0.0.1:8765/api/google/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('🔥 [GOOGLE_CONNECT] ✅ OAuth flow initiated successfully!');
        console.log('🔥 [GOOGLE_CONNECT] Result:', result);
        setGoogleConnectMessage(result.message || 'OAuth flow initiated successfully');
        
        // Refresh the connection status after successful connection
        setTimeout(async () => {
          const isConnected = await checkGoogleStatusFromSidecar();
          setIsGoogleConnected(isConnected);
        }, 5000);
        
      } else {
        const error = await response.json();
        console.error('🔥 [GOOGLE_CONNECT] ❌ Sidecar endpoint failed:', error);
        setGoogleConnectMessage(error.error || 'Failed to connect Google Suite');
      }
      
    } catch (e: any) {
      console.error('🔥 [GOOGLE_CONNECT] ❌ Unexpected error:', e);
      setGoogleConnectMessage(e?.toString?.() || "Failed to connect Google Suite");
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      setIsConnectingGoogle(true);
      
      // Try Tauri command first if available
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        try {
          const result = await invoke<string>("disconnect_google_suite");
          setGoogleConnectMessage(result);
          setIsGoogleConnected(false);
          return;
        } catch (tauriError) {
          console.log('[DEV] Tauri Google disconnect failed, trying sidecar:', tauriError);
        }
      }
      
      // Fallback to sidecar-based disconnection
      try {
        const response = await fetch('http://localhost:8765/api/google/disconnect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const result = await response.json();
          setGoogleConnectMessage(result.message || "Successfully disconnected from Google Suite");
          setIsGoogleConnected(false);
        } else {
          const error = await response.json();
          setGoogleConnectMessage(error.error || "Failed to disconnect from Google Suite");
        }
      } catch (sidecarError) {
        console.error('[DEV] Sidecar disconnect failed:', sidecarError);
        setGoogleConnectMessage("Failed to disconnect from Google Suite");
      }
    } catch (e: any) {
      setGoogleConnectMessage(e?.toString?.() || "Failed to disconnect");
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          aria-label="Open Settings"
          className="cursor-pointer [data-state=open]:bg-[red]"
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

            {/* Google Suite Connect */}
            <div className="flex items-center justify-between gap-2 p-3 rounded-md border border-input/50 bg-background/50">
              <div className="text-sm">
                <div className="font-medium">Connect Google Suite</div>
                <div className="text-xs text-muted-foreground">Authorize access to your Gmail and Calendar</div>
              </div>
              <div className="flex items-center gap-2">
                {googleConnectMessage && (
                  <span className="text-xs text-muted-foreground max-w-[240px] truncate" title={googleConnectMessage}>{googleConnectMessage}</span>
                )}
                {isGoogleConnected ? (
                  <Button onClick={handleDisconnectGoogle} disabled={isConnectingGoogle} size="sm" variant="secondary">
                    {isConnectingGoogle ? "Disconnecting..." : "Disconnect"}
                  </Button>
                ) : (
                  <Button onClick={handleConnectGoogle} disabled={isConnectingGoogle} size="sm">
                    {isConnectingGoogle ? "Connecting..." : "Connect"}
                  </Button>
                )}
              </div>
            </div>

            {/* Document Upload Section */}
            <div className="space-y-3">
              <div className="text-sm font-medium">Document Upload</div>
              <div className="flex items-center justify-between gap-2 p-3 rounded-md border border-input/50 bg-background/50">
                <div className="text-sm">
                  <div className="font-medium">Upload Documents</div>
                  <div className="text-xs text-muted-foreground">Add images, PDFs, and documents as context</div>
                </div>
                <div className="flex items-center gap-2">
                  {attachedFiles.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {attachedFiles.length} file{attachedFiles.length !== 1 ? 's' : ''} attached
                    </div>
                  )}
                  <Button onClick={handleUploadClick} size="sm" variant="outline">
                    <UploadIcon className="h-4 w-4 mr-1" />
                    Upload
                  </Button>
                </div>
              </div>
              
              {/* Show uploaded files from Rust backend */}
              {isLoadingFiles ? (
                <div className="text-xs text-muted-foreground">Loading files...</div>
              ) : uploadedFiles.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    Uploaded Files ({uploadedFiles.length}):
                  </div>
                  {uploadedFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between gap-2 p-2 rounded border border-input/30 bg-background/30">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs truncate" title={file.name}>
                          {file.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({(file.size / 1024 / 1024).toFixed(1)} MB)
                        </span>
                        <div className="flex items-center gap-1">
                          <span className={`text-xs px-1 py-0.5 rounded ${
                            file.is_context_enabled 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                          }`}>
                            {file.is_context_enabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          onClick={() => toggleFileContext(file.id, !file.is_context_enabled)}
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                        >
                          {file.is_context_enabled ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          onClick={() => deleteFile(file.id)}
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                        >
                          <XIcon className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No files uploaded yet</div>
              )}
            </div>

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
            {settings.selectedProvider === "claude" ? (
              <ApiKeyInput
                providerName="Claude (Anthropic)"
                value={settings.claudeApiKey}
                onChange={(value) => updateSettings({ claudeApiKey: value })}
                onSubmit={handleClaudeApiKeySubmit}
                onDelete={handleClaudeApiKeyDelete}
                onKeyPress={handleClaudeKeyPress}
                isSubmitted={settings.isClaudeApiKeySubmitted}
              />
            ) : settings.selectedProvider === "openai" ? (
              <ApiKeyInput
                providerName="OpenAI"
                value={settings.openAiApiKey || settings.apiKey}
                onChange={(value) => updateSettings({ 
                  openAiApiKey: value,
                  apiKey: value 
                })}
                onSubmit={handleOpenAiApiKeySubmit}
                onDelete={handleOpenAiApiKeyDelete}
                onKeyPress={handleOpenAiKeyPress}
                isSubmitted={settings.isOpenAiApiKeySubmitted || settings.isApiKeySubmitted}
              />
            ) : (
              <ApiKeyInput
                providerName={currentProvider?.name || ""}
                value={settings.apiKey}
                onChange={(value) => updateSettings({ apiKey: value })}
                onSubmit={handleApiKeySubmit}
                onDelete={handleApiKeyDelete}
                onKeyPress={handleKeyPress}
                isSubmitted={settings.isApiKeySubmitted}
              />
            )}

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
              disabled={
                settings.selectedProvider === "claude" 
                  ? !settings.isClaudeApiKeySubmitted
                  : settings.selectedProvider === "openai"
                  ? !(settings.isOpenAiApiKeySubmitted || settings.isApiKeySubmitted)
                  : !settings.isApiKeySubmitted
              }
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
        
        {/* Hidden file input for document upload */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,text/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          onChange={handleFileSelect}
          className="hidden"
        />
      </PopoverContent>
    </Popover>
  );
};
