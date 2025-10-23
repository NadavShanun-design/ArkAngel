export interface UITarsConfig {
  provider: 'openai' | 'anthropic' | 'gemini' | 'grok' | 'volcengine' | 'custom';
  apiKey: string;
  model: string;
  baseURL?: string;
}

export interface ExecuteCommandRequest {
  instruction: string;
  config: UITarsConfig;
}

export interface ExecuteCommandResponse {
  success: boolean;
  message: string;
  status: 'running' | 'completed' | 'error' | 'stopped';
  conversations?: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  screenshot?: string; // base64
  action?: string;
  thought?: string;
  loopCount?: number;
  maxLoops?: number;
  error?: string;
}

export interface AgentStatus {
  isRunning: boolean;
  currentTask?: string;
  loopCount: number;
  maxLoops: number;
}
