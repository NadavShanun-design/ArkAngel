// Custom Provider types
export interface CustomProviderInput {
  text: {
    placement: string;
    exampleStructure: any;
  };
  image: {
    type: string;
    placement: string;
    exampleStructure: any;
  };
}

export interface CustomProviderResponse {
  contentPath: string;
  usagePath: string;
}

export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  chatEndpoint: string;
  authType: string;
  authParam?: string;
  customHeaderName?: string;
  defaultModel: string;
  response: CustomProviderResponse;
  input: CustomProviderInput;
  models: null;
  isCustom: true;
  supportsStreaming: boolean;
  responseContentPath?: string;
  responseUsagePath?: string;
  textExampleStructure?: string;
  imageType?: string;
  imageExampleStructure?: string;
}

// Persona types
export interface Persona {
  id: string;
  name: string;
  prompt: string;
  summary: string;
  isDefault?: boolean;
}

// Settings-related types
export interface SettingsState {
  selectedProvider: string;
  apiKey: string;
  isApiKeySubmitted: boolean;
  selectedModel: string;
  customModel: string;
  systemPrompt: string;
  availableModels: string[];
  isLoadingModels: boolean;
  modelsFetchError: string | null;
  openAiApiKey: string;
  isOpenAiApiKeySubmitted: boolean;
  // Angel Profiles
  personas: Persona[];
  currentPersonaId: string;
}

export interface ModelSelectionProps {
  provider: string;
  selectedModel: string;
  customModel: string;
  onModelChange: (value: string) => void;
  onCustomModelChange: (value: string) => void;
  disabled?: boolean;
  availableModels?: string[];
  isLoadingModels?: boolean;
  modelsFetchError?: string | null;
}
