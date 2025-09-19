import { MicIcon, PaperclipIcon, Loader2, XIcon, CopyIcon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
  ScrollArea,
  Input,
} from "@/components";
import { useCompletion, useWindowFocus } from "@/hooks";
import { useWindowResize } from "@/hooks";
import { useRef, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Speech } from "./Speech";
import { MessageHistory } from "../history";
import type { ToolActivity } from "@/types";

export const Completion = () => {
  const {
    input,
    setInput,
    response,
    isLoading,
    error,
    attachedFiles,
    addFile,
    // removeFile,
    // clearFiles,
    submit,
    cancel,
    reset,
    isOpenAIKeyAvailable,
    enableVAD,
    setEnableVAD,
    setState,
    micOpen,
    setMicOpen,
    currentConversationId,
    conversationHistory,
    startNewConversation,
    messageHistoryOpen,
    setMessageHistoryOpen,
    toolActivities,
  } = useCompletion();

  const { resizeWindow } = useWindowResize();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      if (file.type.startsWith("image/")) {
        addFile(file);
      }
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) {
        submit();
      }
    }
  };

  const isPopoverOpen = isLoading || response !== "" || error !== null;

  useEffect(() => {
    resizeWindow(isPopoverOpen || micOpen || messageHistoryOpen);
  }, [isPopoverOpen, micOpen, messageHistoryOpen, resizeWindow]);

  useEffect(() => {
    if ((response || toolActivities.length > 0) && scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollElement) {
        scrollElement.scrollTo({
          top: scrollElement.scrollHeight,
          behavior: "smooth",
        });
      }
    }
  }, [response, toolActivities.length]);

  useWindowFocus({
    onFocusLost: () => {
      setMicOpen(false);
      setMessageHistoryOpen(false);
    },
  });

  // Sort tool activities chronologically for display
  const sortedActivities = useMemo(
    () => [...(toolActivities || [])].sort((a, b) => a.startedAt - b.startedAt),
    [toolActivities]
  );

  // Helper: pretty print JSON if possible, else return string
  const toPrettyText = (value: any): { text: string; isJson: boolean } => {
    try {
      if (typeof value === "string") {
        const parsed = JSON.parse(value);
        return { text: JSON.stringify(parsed, null, 2), isJson: true };
      }
      return { text: JSON.stringify(value, null, 2), isJson: true };
    } catch {
      return { text: typeof value === "string" ? value : String(value), isJson: false };
    }
  };

  // Helper: badge color per status
  const statusBadgeClass = (s: ToolActivity["status"]) => {
    switch (s) {
      case "in_progress":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "complete":
        return "bg-green-100 text-green-700 border-green-200";
      case "error":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-muted text-foreground border-muted";
    }
  };

  return (
    <>
      <Popover open={micOpen} onOpenChange={setMicOpen}>
        <PopoverTrigger asChild>
          {isOpenAIKeyAvailable() && enableVAD ? (
            <Speech
              submit={submit}
              setState={setState}
              setEnableVAD={setEnableVAD}
            />
          ) : (
            <Button
              size="icon"
              onClick={() => {
                setEnableVAD(!enableVAD);
              }}
              className="cursor-pointer"
              title="Toggle voice input"
            >
              <MicIcon className="h-4 w-4" />
            </Button>
          )}
        </PopoverTrigger>

        <PopoverContent
          side="top"
          align="center"
          className={`w-80 p-3 ${isOpenAIKeyAvailable() ? "hidden" : ""}`}
          sideOffset={8}
        >
          <div className="text-sm">
            <div className="font-semibold text-orange-600 mb-1">
              OpenAI Key Required
            </div>
            <p className="text-muted-foreground">
              Speech-to-text requires an OpenAI API key for Whisper. Please
              configure it in settings to enable voice input.
            </p>
          </div>
        </PopoverContent>
      </Popover>

      <div className="relative flex-1">
        <Popover
          open={isPopoverOpen}
          onOpenChange={(open) => {
            if (!open && !isLoading) {
              reset();
            }
          }}
        >
          <PopoverTrigger asChild className="!border-none">
            <div className="relative select-none">
              <Input
                placeholder="Ask me anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading}
                className={`${
                  currentConversationId && conversationHistory.length > 0
                    ? "pr-14"
                    : "pr-12"
                }`}
              />

              {currentConversationId &&
                conversationHistory.length > 0 &&
                !isLoading && (
                  <div className="absolute select-none right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <MessageHistory
                      conversationHistory={conversationHistory}
                      onStartNewConversation={startNewConversation}
                      messageHistoryOpen={messageHistoryOpen}
                      setMessageHistoryOpen={setMessageHistoryOpen}
                    />
                  </div>
                )}

              {isLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </PopoverTrigger>

          <PopoverContent
            align="center"
            side="bottom"
            className="w-screen p-0 border shadow-lg overflow-hidden"
            sideOffset={8}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
              <h3 className="font-semibold text-sm select-none">AI Response</h3>
              <div className="flex items-center gap-2 select-none">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(response);
                  }}
                  disabled={isLoading}
                  className="cursor-pointer"
                  title="Copy response to clipboard"
                >
                  <CopyIcon />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (isLoading) {
                      cancel();
                    } else {
                      reset();
                    }
                  }}
                  className="cursor-pointer"
                  title={isLoading ? "Cancel loading" : "Clear conversation"}
                >
                  <XIcon />
                </Button>
              </div>
            </div>

            <ScrollArea ref={scrollAreaRef} className="h-[calc(100vh-7rem)]">
              <div className="p-4">
                {error && (
                  <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                    <strong>Error:</strong> {error}
                  </div>
                )}

                {/* Tool activities shown first, in chronological order */}
                {sortedActivities.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs font-semibold mb-2 select-none">Tool activity</div>
                    <div className="space-y-2 text-xs">
                      {sortedActivities.map((a: ToolActivity) => {
                        const hasInput = a.input !== undefined && a.input !== null;
                        const hasOutput = a.output !== undefined && a.output !== null;
                        const hasError = !!a.error;
                        const inputPretty = hasInput ? toPrettyText(a.input) : null;
                        const outputPretty = hasOutput ? toPrettyText(a.output) : null;

                        return (
                          <details
                            key={a.id}
                            className={`tool-activity ${a.status === "in_progress" ? "loading" : ""} p-2 rounded border bg-muted/20 overflow-hidden`}
                          >
                            <summary className="flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                              {/* Left: tool name + status */}
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${statusBadgeClass(a.status)}`}>
                                  {a.status === "in_progress" ? "RUNNING" : a.status === "complete" ? "DONE" : "ERROR"}
                                </span>
                                <span className="font-medium truncate">{a.name}</span>
                              </div>
                              {/* Right: error badge (if any) + timestamp + chevron */}
                              <div className="flex items-center gap-2 text-muted-foreground flex-shrink-0">
                                {hasError && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded border bg-red-100 text-red-700 border-red-200">Error</span>
                                )}
                                <span className="text-[10px]">{new Date(a.endedAt || a.startedAt).toLocaleTimeString()}</span>
                                <svg className="h-3 w-3 transition-transform duration-200 [details[open]_&]:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                              </div>
                            </summary>

                            <div className="mt-2 space-y-2 overflow-hidden">
                              {hasInput && inputPretty && (
                                <div className="overflow-hidden">
                                  <div className="text-muted-foreground mb-1">Input</div>
                                  <pre className={`text-[10px] whitespace-pre-wrap break-words break-all p-2 rounded border overflow-x-auto max-w-full ${inputPretty.isJson ? "bg-muted" : "bg-transparent"}`}>
                                    {inputPretty.text}
                                  </pre>
                                </div>
                              )}

                              {hasOutput && outputPretty && (
                                <div className="overflow-hidden">
                                  <div className="text-muted-foreground mb-1">Output</div>
                                  <pre className={`text-[10px] whitespace-pre-wrap break-words break-all p-2 rounded border overflow-x-auto max-w-full ${outputPretty.isJson ? "bg-muted" : "bg-transparent"}`}>
                                    {outputPretty.text}
                                  </pre>
                                </div>
                              )}

                              {hasError && (
                                <div className="overflow-hidden">
                                  <div className="text-muted-foreground mb-1">Error</div>
                                  <pre className="text-[10px] whitespace-pre-wrap break-words break-all p-2 rounded border bg-red-50 text-red-700 border-red-200 overflow-x-auto max-w-full">
                                    {a.error}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Assistant response shown after tool activity */}
                {response && (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      pre: ({ node, ...props }) => (
                        <pre
                          {...props}
                          className="whitespace-pre-wrap break-words"
                        />
                      ),
                      code: ({ node, ...props }) => (
                        <code
                          {...props}
                          className="whitespace-pre-wrap break-words"
                        />
                      ),
                    }}
                  >
                    {response}
                  </ReactMarkdown>
                )}

                {isLoading && (
                  <div className="flex items-center gap-2 mt-4 text-muted-foreground animate-pulse select-none">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Generating response...</span>
                  </div>
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      <div className="relative">
        <Button
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="cursor-pointer"
          title="Attach images"
        >
          <PaperclipIcon className="h-4 w-4" />
        </Button>

        {attachedFiles.length > 0 && (
          <div className="absolute -top-2 -right-2 bg-primary-foreground text-primary rounded-full h-5 w-5 flex border border-primary items-center justify-center text-xs font-medium">
            {attachedFiles.length}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </>
  );
};
