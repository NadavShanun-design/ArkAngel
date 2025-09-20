import { KeyIcon, TrashIcon } from "lucide-react";
import { Button, Input, Label } from "@/components";

interface ApiKeyInputProps {
  providerName: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onDelete: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  isSubmitted: boolean;
  disabled?: boolean;
}

export const ApiKeyInput = ({
  providerName,
  value,
  onChange,
  onSubmit,
  onDelete,
  onKeyPress,
  isSubmitted,
  disabled,
}: ApiKeyInputProps) => {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm font-semibold flex items-center gap-2">
          API Key
        </Label>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Enter your <span className="font-medium">{providerName}</span> API key
          to authenticate and access AI models. Your key is stored locally and
          never shared.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          type="password"
          placeholder="**********"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyPress={onKeyPress}
          disabled={isSubmitted || disabled}
          className="flex-1 h-11 border-1 border-input/50 focus:border-primary/50 transition-colors"
        />
        {!isSubmitted ? (
          <Button
            onClick={onSubmit}
            disabled={!value.trim()}
            size="icon"
            className="shrink-0 h-11 w-11"
            title="Submit API Key"
          >
            <KeyIcon className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={onDelete}
            size="icon"
            variant="destructive"
            className="shrink-0 h-11 w-11"
            title="Remove API Key"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
