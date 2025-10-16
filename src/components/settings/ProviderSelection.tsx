import { useEffect, useState } from "react";
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components";
import { providers } from "@/config";
import { loadCustomProvidersFromStorage } from "@/lib";
import { CustomProvider } from "@/types";

interface ProviderSelectionProps {
  value: string;
  onChange: (value: string) => void;
  refreshKey?: number;
}

export const ProviderSelection = ({
  value,
  onChange,
  refreshKey,
}: ProviderSelectionProps) => {
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>([]);

  useEffect(() => {
    setCustomProviders(loadCustomProvidersFromStorage());
  }, [refreshKey]);
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm font-semibold">AI Provider</Label>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Select your preferred AI service provider to get started.
        </p>
      </div>

      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full border-1 border-input/50 focus:border-primary/50 transition-colors">
          <SelectValue placeholder="Choose your AI provider" />
        </SelectTrigger>
        <SelectContent>
          {providers
            .filter((provider) => provider.id !== "custom")
            .map((provider) => (
              <SelectItem
                key={provider.id}
                value={provider.id}
                className="cursor-pointer hover:bg-accent/50"
              >
                <span className="font-medium">{provider.name}</span>
              </SelectItem>
            ))}

          {customProviders.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-t mt-2 pt-2">
                Custom Providers
              </div>
              {customProviders.map((provider) => (
                <SelectItem
                  key={provider.id}
                  value={provider.id}
                  className="cursor-pointer hover:bg-accent/50"
                >
                  <span className="font-medium">{provider.name}</span>
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
};
