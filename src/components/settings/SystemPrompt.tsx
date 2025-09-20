import { Label, Textarea } from "@/components";

interface SystemPromptProps {
  value: string;
  onChange: (value: string) => void;
}

export const SystemPrompt = ({ value, onChange }: SystemPromptProps) => {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm font-semibold">System Prompt</Label>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Define the AI's behavior and personality. This message sets the
          context for all conversations.
        </p>
      </div>

      <Textarea
        placeholder="You are a helpful AI assistant. Be concise, accurate, and friendly in your responses..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[100px] resize-none border-1 border-input/50 focus:border-primary/50 transition-colors"
      />
      <p className="text-xs text-muted-foreground/70">
        💡 Tip: Be specific about tone, expertise level, and response format
      </p>
    </div>
  );
};
