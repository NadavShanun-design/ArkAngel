// Completion-related types
export interface AttachedFile {
  id: string;
  name: string;
  type: string;
  base64: string;
  size: number;
}

// File storage types for document uploads
export interface FileInfo {
  id: string;
  name: string;
  file_type: string;
  size: number;
  upload_date: string;
  content: string;
  is_context_enabled: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  attachedFiles?: AttachedFile[];
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface AgentToolEvent {
  id: string;
  type: "start" | "stream" | "end" | "error";
  name: string;
  args?: any;
  outputChunk?: string;
  timestamp: number;
}

// Grouped tool activity (start/end merged)
export interface ToolActivity {
  id: string;
  name: string;
  status: "in_progress" | "complete" | "error";
  input?: any | null;
  output?: any | null;
  error?: string | null;
  startedAt: number;
  endedAt: number | null;
}

export interface CompletionState {
  input: string;
  response: string;
  isLoading: boolean;
  error: string | null;
  attachedFiles: AttachedFile[];
  currentConversationId: string | null;
  conversationHistory: ChatMessage[];
  toolActivities: ToolActivity[];
}

// Provider-related types
export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  chatEndpoint: string;
  authType: "bearer" | "x-api-key" | "query";
  authParam?: string;
  defaultModel: string;
  response: {
    contentPath: string;
    usagePath: string;
  };
  input: {
    text: {
      placement: string;
      exampleStructure: any;
    };
    image: {
      type: string;
      placement: string;
      exampleStructure: any;
    };
  };
  models: {
    endpoint: string;
    method: string;
    responsePath: string;
    idKey: string;
  } | null;
}
