import { useState, useCallback, useRef, useEffect } from "react";
import {
  getSettings,
  fileToBase64,
  saveConversation,
  getConversation,
  generateConversationTitle,
} from "@/lib";
import {
  AttachedFile,
  CompletionState,
  ChatMessage,
  ChatConversation,
  ToolActivity,
} from "@/types";

export const useCompletion = () => {
  const [state, setState] = useState<CompletionState>({
    input: "",
    response: "",
    isLoading: false,
    error: null,
    attachedFiles: [],
    currentConversationId: null,
    conversationHistory: [],
    toolActivities: [],
  });
  const [micOpen, setMicOpen] = useState(false);
  const [enableVAD, setEnableVAD] = useState(false);
  const [messageHistoryOpen, setMessageHistoryOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const setInput = useCallback((value: string) => {
    setState((prev) => ({ ...prev, input: value }));
  }, []);

  const setResponse = useCallback((value: string) => {
    setState((prev) => ({ ...prev, response: value }));
  }, []);

  const addFile = useCallback(async (file: File) => {
    try {
      const base64 = await fileToBase64(file);
      const attachedFile: AttachedFile = {
        id: Date.now().toString(),
        name: file.name,
        type: file.type,
        base64,
        size: file.size,
      };

      setState((prev) => ({
        ...prev,
        attachedFiles: [...prev.attachedFiles, attachedFile],
      }));
    } catch (error) {
      console.error("Failed to process file:", error);
    }
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setState((prev) => ({
      ...prev,
      attachedFiles: prev.attachedFiles.filter((f) => f.id !== fileId),
    }));
  }, []);

  const clearFiles = useCallback(() => {
    setState((prev) => ({ ...prev, attachedFiles: [] }));
  }, []);

  const submit = useCallback(
    async (speechText?: string) => {
      const input = speechText || state.input;


      if (!input.trim()) {
        return;
      }

      if (speechText) {
        setState((prev) => ({
          ...prev,
          input: speechText,
        }));
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        response: "",
        toolActivities: [],
      }));

      try {
        let fullResponse = "";

        // Gather optimized context from enabled files with smart chunking
        let fileContext: string[] | undefined = undefined;
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          // Use the new optimized context system with smart chunking
          fileContext = await invoke<string[]>('get_optimized_file_context');
          console.log(`[useCompletion] Loaded ${fileContext?.length || 0} context chunks from uploaded files`);
        } catch (error) {
          console.warn("Failed to load optimized file context, falling back to summaries:", error);
          // Fallback to the old summary system
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            const files = await invoke<any[]>('list_uploaded_files');
            fileContext = (files || [])
              .filter((f: any) => f?.is_context_enabled)
              .map((f: any) => {
                const s = (f?.summary && String(f.summary).trim().length > 0)
                  ? String(f.summary)
                  : `File ${f?.name || f?.id}: ${String(f?.content || '').slice(0, 200)}...`;
                return s;
              });
          } catch (fallbackError) {
            console.warn("Failed to load file summaries:", fallbackError);
          }
        }

        const url = "http://127.0.0.1:8765/api/chat/stream";
        console.log("[ui] Connecting to sidecar:", url);
        
        // Get active persona prompt
        const settings = getSettings();
        const activePersona = settings?.personas?.find((p: any) => p.id === settings?.currentPersonaId);
        const systemPrompt = activePersona?.prompt || settings?.systemPrompt || undefined;
        
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: input,
            systemPrompt,
            apiKey: getSettings()?.openAiApiKey || getSettings()?.apiKey || undefined,
            model: getSettings()?.selectedModel || getSettings()?.customModel || "gpt-4o-mini",
            providerId: getSettings()?.selectedProvider || "openai",
            fileContext,
            // Note: files are processed with smart chunking and included in the system prompt.
          }),
          signal: abortControllerRef.current.signal,
        });

        console.log("[ui] Sidecar response status:", res.status, res.statusText);
        if (!res.ok || !res.body) {
          throw new Error(`Sidecar error: ${res.status} ${res.statusText}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const json = line.slice(5).trim();
            if (!json) continue;
            try {
              const evt = JSON.parse(json);
              const type = evt?.type as string | undefined;
              if (type === "token") {
                const chunk = evt.content || "";
                if (chunk) {
                  fullResponse += chunk;
                  setState((prev) => ({ ...prev, response: prev.response + chunk }));
                }
              } else if (type === "tool_start") {
                // Create a new in-progress activity
                setState((prev) => {
                  const id = `act_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                  const activity: ToolActivity = {
                    id,
                    name: evt.tool || evt.provider || "unknown_tool",
                    status: "in_progress",
                    input: evt.input ?? null,
                    output: null,
                    error: null,
                    startedAt: Date.now(),
                    endedAt: null,
                  };
                  return { ...prev, toolActivities: [...(prev.toolActivities || []), activity] };
                });
              } else if (type === "tool_end") {
                // Update the last in-progress activity for this tool
                setState((prev) => {
                  const activities = [...(prev.toolActivities || [])];
                  const toolName = evt.tool || evt.provider || "unknown_tool";
                  for (let i = activities.length - 1; i >= 0; i--) {
                    const a = activities[i];
                    if (a.name === toolName && a.status === "in_progress") {
                      activities[i] = {
                        ...a,
                        status: "complete",
                        output: evt.output ?? null,
                        endedAt: Date.now(),
                      };
                      return { ...prev, toolActivities: activities };
                    }
                  }
                  // If no matching start found, append a completed activity
                  const id = `act_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                  activities.push({
                    id,
                    name: toolName,
                    status: "complete",
                    input: null,
                    output: evt.output ?? null,
                    error: null,
                    startedAt: Date.now(),
                    endedAt: Date.now(),
                  });
                  return { ...prev, toolActivities: activities };
                });
              } else if (type === "oauth_required") {
                // Represent as an error-like activity for the provider
                setState((prev) => ({
                  ...prev,
                  toolActivities: [
                    ...(prev.toolActivities || []),
                    {
                      id: `act_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                      name: evt.provider || "oauth",
                      status: "error",
                      input: null,
                      output: null,
                      error: evt.content || "OAuth is required",
                      startedAt: Date.now(),
                      endedAt: Date.now(),
                    },
                  ],
                }));
              } else if (type === "error") {
                const errorMsg = evt.error || evt.content || "An error occurred";
                // Attach to most recent in-progress activity if present, otherwise set global error
                setState((prev) => {
                  const activities = [...(prev.toolActivities || [])];
                  for (let i = activities.length - 1; i >= 0; i--) {
                    const a = activities[i];
                    if (a.status === "in_progress") {
                      activities[i] = {
                        ...a,
                        status: "error",
                        error: errorMsg,
                        endedAt: Date.now(),
                      };
                      return { ...prev, toolActivities: activities };
                    }
                  }
                  return { ...prev, error: errorMsg };
                });
              } else if (type === "start" || type === "end" || type === "complete" || type === "response_start") {
                // ignore control events
              }
            } catch (e) {
              console.warn("[ui] Failed parsing SSE line:", line, e);
            }
          }
        }

        console.log("[ui] Stream finished. Response length:", fullResponse.length);
        setState((prev) => ({ ...prev, isLoading: false }));

        if (fullResponse) {
          const savedId = saveCurrentConversation(input, fullResponse, state.attachedFiles);
          // Best-effort: link currently context-enabled files to this conversation
          try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('link_enabled_files_to_conversation', { conversation_id: savedId });
          } catch (error) {
            console.warn('Failed to link files to conversation:', error);
          }
          setState((prev) => ({
            ...prev,
            input: "",
            attachedFiles: [],
          }));
        }
      } catch (error) {
        console.error("[ui] Sidecar stream error:", error);
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "An error occurred",
          isLoading: false,
        }));
      }
    },
    [state.input, state.attachedFiles, state.isLoading]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      console.log("[ui] Aborting sidecar stream");
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState((prev) => ({ ...prev, isLoading: false }));
  }, []);

  const reset = useCallback(() => {
    cancel();
    setState((prev) => ({
      ...prev,
      input: "",
      response: "",
      error: null,
      attachedFiles: [],
      toolActivities: [],
    }));
  }, [cancel]);

  const isOpenAIKeyAvailable = useCallback(() => {
    const settings = getSettings();
    if (!settings) return false;
    return (
      settings.openAiApiKey ||
      (settings.selectedProvider === "openai" && settings.apiKey)
    );
  }, []);

  const loadConversation = useCallback((conversation: ChatConversation) => {
    setState((prev) => ({
      ...prev,
      currentConversationId: conversation.id,
      conversationHistory: conversation.messages,
      input: "",
      response: "",
      error: null,
      isLoading: false,
    }));
  }, []);

  const startNewConversation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentConversationId: null,
      conversationHistory: [],
      input: "",
      response: "",
      error: null,
      isLoading: false,
      attachedFiles: [],
      toolActivities: [],
    }));
  }, []);

  const saveCurrentConversation = useCallback(
    (
      userMessage: string,
      assistantResponse: string,
      _attachedFiles: AttachedFile[]
    ): string => {
      const conversationId =
        state.currentConversationId ||
        `conv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      const timestamp = Date.now();

      const userMsg: ChatMessage = {
        id: `msg_${timestamp}_user`,
        role: "user",
        content: userMessage,
        timestamp,
      };

      const assistantMsg: ChatMessage = {
        id: `msg_${timestamp}_assistant`,
        role: "assistant",
        content: assistantResponse,
        timestamp: timestamp + 1,
      };

      const newMessages = [...state.conversationHistory, userMsg, assistantMsg];
      const title =
        state.conversationHistory.length === 0
          ? generateConversationTitle(userMessage)
          : undefined;

      const conversation: ChatConversation = {
        id: conversationId,
        title:
          title ||
          (state.currentConversationId
            ? getConversation(state.currentConversationId)?.title ||
              generateConversationTitle(userMessage)
            : generateConversationTitle(userMessage)),
        messages: newMessages,
        createdAt: state.currentConversationId
          ? getConversation(state.currentConversationId)?.createdAt || timestamp
          : timestamp,
        updatedAt: timestamp,
      };

      saveConversation(conversation);

      setState((prev) => ({
        ...prev,
        currentConversationId: conversationId,
        conversationHistory: newMessages,
      }));
      return conversationId;
    },
    [state.currentConversationId, state.conversationHistory]
  );

  useEffect(() => {
    const handleConversationSelected = (event: any) => {
      const conversation = event.detail;
      loadConversation(conversation);
    };

    const handleNewConversation = () => {
      startNewConversation();
    };

    const handleConversationDeleted = (event: any) => {
      const deletedId = event.detail;
      if (state.currentConversationId === deletedId) {
        startNewConversation();
      }
    };

    window.addEventListener("conversationSelected", handleConversationSelected);
    window.addEventListener("newConversation", handleNewConversation);
    window.addEventListener("conversationDeleted", handleConversationDeleted);

    return () => {
      window.removeEventListener(
        "conversationSelected",
        handleConversationSelected
      );
      window.removeEventListener("newConversation", handleNewConversation);
      window.removeEventListener(
        "conversationDeleted",
        handleConversationDeleted
      );
    };
  }, [loadConversation, startNewConversation, state.currentConversationId]);

  return {
    input: state.input,
    setInput,
    response: state.response,
    setResponse,
    isLoading: state.isLoading,
    error: state.error,
    attachedFiles: state.attachedFiles,
    addFile,
    removeFile,
    clearFiles,
    submit,
    cancel,
    reset,
    isOpenAIKeyAvailable,
    setState,
    enableVAD,
    setEnableVAD,
    micOpen,
    setMicOpen,
    currentConversationId: state.currentConversationId,
    conversationHistory: state.conversationHistory,
    loadConversation,
    startNewConversation,
    messageHistoryOpen,
    setMessageHistoryOpen,
    toolActivities: state.toolActivities,
  };
};
