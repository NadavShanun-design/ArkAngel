import { Loader2 } from "lucide-react";
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components";
import { getProviderById } from "@/lib";
import { ModelSelectionProps } from "@/types";

const getPlaceholder = (providerId: string) => {
  const provider = getProviderById(providerId);

  if (provider?.isCustom && provider.defaultModel) {
    return provider.defaultModel;
  }

  switch (providerId) {
    case "claude":
      return "claude-3-sonnet-20240229";
    case "gemini":
      return "gemini-pro";
    case "grok":
      return "grok-1";
    default:
      return "Enter model name";
  }
};

export const ModelSelection = ({
  provider,
  selectedModel,
  customModel,
  onModelChange,
  onCustomModelChange,
  disabled,
  availableModels = [],
  isLoadingModels = false,
  modelsFetchError = null,
}: ModelSelectionProps) => {
  const hasAvailableModels = availableModels.length > 0;
  const shouldShowSelect = hasAvailableModels && !modelsFetchError;
  const currentProvider = getProviderById(provider);

  // For custom providers, use the default model as initial value if customModel is empty
  const displayValue =
    currentProvider?.isCustom && !customModel && currentProvider.defaultModel
      ? currentProvider.defaultModel
      : customModel;

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-semibold flex items-center gap-2">
          AI Model
          {isLoadingModels && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </Label>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {shouldShowSelect
            ? "Select models that support both text and image as input, and best fits your needs. "
            : "Enter the model name/ID for your selected provider (e.g., claude-3-sonnet, gemini-pro)."}
        </p>
      </div>

      {/* Show error message if model fetching failed */}
      {modelsFetchError && (
        <div className="text-xs text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
          ⚠️ {modelsFetchError}
        </div>
      )}

      {shouldShowSelect ? (
        <Select
          value={selectedModel}
          onValueChange={onModelChange}
          disabled={disabled || isLoadingModels}
        >
          <SelectTrigger className="w-full h-11 border-1 border-input/50 focus:border-primary/50 transition-colors">
            <SelectValue placeholder="Select your preferred model">
              {selectedModel && <span>{selectedModel}</span>}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {availableModels.map((modelId) => (
              <SelectItem
                key={modelId}
                value={modelId}
                className="cursor-pointer hover:bg-accent/50"
              >
                <span className="font-medium">
                  {modelId.replace("models/", "")}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="space-y-2">
          <Input
            placeholder={getPlaceholder(provider)}
            value={displayValue}
            onChange={(e) => onCustomModelChange(e.target.value)}
            disabled={disabled || isLoadingModels}
            className="w-full h-11 border-1 border-input/50 focus:border-primary/50 transition-colors"
          />
          <p className="text-xs text-muted-foreground/70">
            💡 Tip: Check your provider's documentation for best available
            models.
            {provider === "openai" && modelsFetchError && (
              <span className="block mt-1 text-destructive">
                Unable to fetch models automatically. Please enter manually.
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
};
