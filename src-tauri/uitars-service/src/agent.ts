import { GUIAgent } from '@ui-tars/sdk';
import { NutJSOperator } from '@ui-tars/operator-nut-js';
import { StatusEnum } from '@ui-tars/shared/types';
import type {
  UITarsConfig,
  ExecuteCommandResponse,
  AgentStatus
} from './types.js';
import { getProviderConfig } from './config.js';

export class UITarsAgentService {
  private agent: GUIAgent<NutJSOperator> | null = null;
  private abortController: AbortController | null = null;
  private status: AgentStatus = {
    isRunning: false,
    loopCount: 0,
    maxLoops: 25,
  };

  async executeCommand(
    instruction: string,
    config: UITarsConfig,
    onUpdate?: (response: ExecuteCommandResponse) => void
  ): Promise<ExecuteCommandResponse> {
    // Stop any existing agent
    this.stop();

    // Create abort controller
    this.abortController = new AbortController();

    // Get provider config
    const modelConfig = getProviderConfig(config);

    // Initialize agent
    this.agent = new GUIAgent({
      model: {
        ...modelConfig,
        model: modelConfig.model!,
      },
      operator: new NutJSOperator(),
      signal: this.abortController.signal,
      maxLoopCount: 25,
      loopIntervalInMs: 1000,

      onData: ({ data }) => {
        this.status.isRunning = true;
        this.status.loopCount = data.conversations.length;

        // Get latest conversation message
        const latestConv = data.conversations[data.conversations.length - 1];

        // Parse thought and action from the message
        let thought = '';
        let action = '';
        let rawMessage = latestConv?.value || '';

        // Try to extract Thought and Action from the format:
        // Thought: ...
        // Action: ...
        const thoughtMatch = rawMessage.match(/Thought:\s*([^\n]+(?:\n(?!Action:)[^\n]+)*)/i);
        const actionMatch = rawMessage.match(/Action:\s*(.+)/is);

        if (thoughtMatch) {
          thought = thoughtMatch[1].trim();
        }
        if (actionMatch) {
          action = actionMatch[1].trim();
        }

        // Convert conversations to our format
        const conversations = data.conversations.map(conv => ({
          role: conv.from === 'gpt' ? 'assistant' as const :
                conv.from === 'human' ? 'user' as const :
                'system' as const,
          content: conv.value,
        }));

        const response: ExecuteCommandResponse = {
          success: true,
          message: rawMessage,
          status: data.status === StatusEnum.END ? 'completed' : 'running',
          conversations,
          screenshot: latestConv?.screenshotBase64,
          action: action || latestConv?.predictionParsed?.[0]?.action_type,
          thought: thought,
          loopCount: this.status.loopCount,
          maxLoops: this.status.maxLoops,
        };

        onUpdate?.(response);
      },

      onError: ({ error, data }) => {
        this.status.isRunning = false;

        // Convert conversations to our format
        const conversations = data.conversations.map(conv => ({
          role: conv.from === 'gpt' ? 'assistant' as const :
                conv.from === 'human' ? 'user' as const :
                'system' as const,
          content: conv.value,
        }));

        const response: ExecuteCommandResponse = {
          success: false,
          message: error.message,
          status: 'error',
          error: error.message,
          conversations,
        };

        onUpdate?.(response);
      },
    });

    try {
      // Run the agent
      await this.agent.run(instruction);

      return {
        success: true,
        message: 'Task completed successfully',
        status: 'completed',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      this.status.isRunning = false;
    }
  }

  stop() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.agent) {
      this.agent.stop();
      this.agent = null;
    }

    this.status.isRunning = false;
  }

  getStatus(): AgentStatus {
    return { ...this.status };
  }
}
