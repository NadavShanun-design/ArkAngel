import { MessageSquareText, ChevronUp, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
  ScrollArea,
} from "@/components";
import { ChatMessage } from "@/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessageHistoryProps {
  conversationHistory: ChatMessage[];
  onStartNewConversation: () => void;
  messageHistoryOpen: boolean;
  setMessageHistoryOpen: (open: boolean) => void;
}

// Define markdown components outside the main component
const markdownComponents = {
  pre: ({ ...props }: any) => (
    <pre
      {...props}
      className="whitespace-pre-wrap break-words"
    />
  ),
  code: ({ ...props }: any) => (
    <code
      {...props}
      className="whitespace-pre-wrap break-words"
    />
  ),
};

export const MessageHistory = ({
  conversationHistory,
  onStartNewConversation,
  messageHistoryOpen,
  setMessageHistoryOpen,
}: MessageHistoryProps) => {
  // Generate a simple one-sentence summary
  const generateSummary = (messages: ChatMessage[]): string => {
    if (messages.length === 0) return "No messages yet";

    const userMessages = messages.filter(msg => msg.role === 'user');

    if (userMessages.length === 0) return "Conversation started";

    const firstUserMessage = userMessages[0].content;
    const lastUserMessage = userMessages[userMessages.length - 1].content;

    // Create a simple summary based on the conversation
    let summary = "";

    if (userMessages.length === 1) {
      summary = `Single question: ${firstUserMessage.substring(0, 50)}${firstUserMessage.length > 50 ? '...' : ''}`;
    } else {
      summary = `${userMessages.length} exchanges about ${lastUserMessage.substring(0, 40)}${lastUserMessage.length > 40 ? '...' : ''}`;
    }

    return summary;
  };

  const summary = generateSummary(conversationHistory);

  return (
    <Popover open={messageHistoryOpen} onOpenChange={setMessageHistoryOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          aria-label="View Current Conversation"
          className="relative cursor-pointer w-12 h-7 px-2 flex gap-1 items-center justify-center"
        >
          <div className="flex items-center justify-center text-xs font-medium">
            {conversationHistory.length}
          </div>
          <MessageSquareText className="h-5 w-5" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="bottom"
        className="select-none w-screen p-0 mt-3 border overflow-hidden border-input/50"
      >
        <div className="border-b border-input/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-col">
              <h2 className="text-lg font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Current Conversation
              </h2>
              <p className="text-xs text-muted-foreground">
                {conversationHistory.length} messages in this conversation
              </p>
              {conversationHistory.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1 italic">
                  {summary}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => {
                  onStartNewConversation();
                  setMessageHistoryOpen(false);
                }}
                className="text-xs"
              >
                New Chat
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setMessageHistoryOpen(false)}
                className="text-xs"
              >
                {messageHistoryOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-10rem)]">
          <div className="p-4 space-y-4">
            {conversationHistory
              .slice()
              .sort((a, b) => b?.timestamp - a?.timestamp)
              .map((message) => (
                <div
                  key={message.id}
                  className={`p-3 rounded-lg ${
                    message.role === "user"
                      ? "bg-primary/10 border-l-4 border-primary"
                      : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase">
                      {message.role === "user" ? "You" : "AI"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="text-sm select-auto break-words whitespace-pre-wrap">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
