import { KeyIcon, TrashIcon } from "lucide-react";
import { Button, Input, Label } from "@/components";

interface SpeechProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onDelete: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  isSubmitted: boolean;
  disabled?: boolean;
}

export const Speech = ({
  value,
  onChange,
  onSubmit,
  onDelete,
  onKeyPress,
  isSubmitted,
  disabled,
}: SpeechProps) => {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm font-semibold flex items-center gap-2">
          Speech-to-Text (OpenAI Whisper)
        </Label>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Enter your <span className="font-medium">OpenAI</span> API key to
          enable speech-to-text functionality using Whisper. This is required
          for voice input when using non-OpenAI providers. Your key is stored
          locally and never shared.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          type="password"
          placeholder="sk-..."
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
            title="Submit OpenAI API Key"
          >
            <KeyIcon className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={onDelete}
            size="icon"
            variant="destructive"
            className="shrink-0 h-11 w-11"
            title="Remove OpenAI API Key"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
