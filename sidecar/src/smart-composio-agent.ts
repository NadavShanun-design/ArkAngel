/**
 * Smart Composio Agent - Intelligent Tool Selection with LangChain
 *
 * This is the core intelligence layer that:
 * - Analyzes user queries to understand intent
 * - Automatically selects appropriate tools
 * - Executes tools with correct parameters
 * - Streams responses in real-time
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { getComposioClient, isComposioConfigured } from './composio-client.js';
import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

/**
 * Agent configuration options
 */
export interface AgentConfig {
  apiKey: string;
  model: string;
  providerId: 'openai' | 'claude' | string;
  systemPrompt?: string;
  temperature?: number;
  maxIterations?: number;
  userId: string;
}

/**
 * Response chunk from agent
 */
export interface AgentChunk {
  type: 'text' | 'tool_start' | 'tool_end' | 'error' | 'done';
  content?: string;
  tool?: string;
  input?: any;
  output?: any;
  error?: string;
}

/**
 * Smart Composio Agent
 * Uses LangChain with Composio tools for intelligent automation
 */
export class SmartComposioAgent {
  private llm: ChatOpenAI | ChatAnthropic;
  private composio = getComposioClient();
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;

    // Create appropriate LLM based on provider
    if (config.providerId === 'claude' || config.providerId === 'anthropic') {
      this.llm = new ChatAnthropic({
        apiKey: config.apiKey,
        model: config.model || 'claude-sonnet-4-20250514',
        temperature: config.temperature || 0,
        streaming: true
      });
    } else {
      // Default to OpenAI
      this.llm = new ChatOpenAI({
        apiKey: config.apiKey,
        model: config.model || 'gpt-4o-mini',
        temperature: config.temperature || 0,
        streaming: true
      });
    }

    console.log(`[SmartComposioAgent] Initialized with model: ${config.model}, provider: ${config.providerId}`);
  }

  /**
   * Process a user query with intelligent tool selection
   * @param message - User's message
   * @param conversationHistory - Previous messages for context
   * @param fileContext - Optional file context chunks
   */
  async *processQuery(
    message: string,
    conversationHistory: any[] = [],
    fileContext?: string[]
  ): AsyncGenerator<AgentChunk> {
    if (!isComposioConfigured()) {
      yield {
        type: 'error',
        error: 'Composio is not configured. Tools are disabled. Responding with LLM only.'
      };

      // Fall back to direct LLM response
      yield* this.directLLMResponse(message, conversationHistory, fileContext);
      return;
    }

    try {
      // Step 1: Get user's connected tools
      // TODO: Update when SDK provides getEntity/getConnections API
      // For now, fall back to direct LLM response
      console.log('[SmartComposioAgent] Composio entity API not yet available, using direct LLM');
      yield* this.directLLMResponse(message, conversationHistory, fileContext);
      return;

      // DISABLED CODE - Re-enable when SDK is updated:
      // const entity = await this.composio.getEntity(this.config.userId);
      // const connections = await entity.getConnections();
      //
      // if (connections.length === 0) {
      //   console.log('[SmartComposioAgent] No tools connected, using direct LLM');
      //   yield* this.directLLMResponse(message, conversationHistory, fileContext);
      //   return;
      // }
      //
      // // Step 2: Get tools for this user
      // const connectedApps = [...new Set(connections.map((c: any) => c.appName || c.app))];
      // console.log(`[SmartComposioAgent] User has ${connectedApps.length} connected apps:`, connectedApps);
      //
      // const toolset = await this.composio.getToolSet({
      //   apps: connectedApps,
      //   entityId: this.config.userId
      // });
      //
      // console.log(`[SmartComposioAgent] Loaded ${toolset.tools.length} tools`);
      //
      // // Step 3: Create agent with tools
      // const agent = await this.createAgentExecutor(toolset.tools);
      //
      // // Step 4: Build input with conversation history
      // const input = this.buildAgentInput(message, conversationHistory, fileContext);
      //
      // // Step 5: Execute agent with streaming
      // yield { type: 'text', content: '' }; // Signal start
      //
      // const stream = await agent.stream(input);
      //
      // for await (const chunk of stream) {
      //   // Handle different chunk types
      //   if (chunk.intermediateSteps) {
      //     // Tool execution steps
      //     for (const step of chunk.intermediateSteps) {
      //       const action = step.action;
      //       const observation = step.observation;
      //
      //       yield {
      //         type: 'tool_start',
      //         tool: action.tool,
      //         input: action.toolInput
      //       };
      //
      //       yield {
      //         type: 'tool_end',
      //         tool: action.tool,
      //         output: observation
      //       };
      //     }
      //   }
      //
      //   if (chunk.output) {
      //     // Final output text
      //     yield {
      //       type: 'text',
      //       content: chunk.output
      //     };
      //   }
      // }
      //
      // yield { type: 'done' };
    } catch (error: any) {
      console.error('[SmartComposioAgent] Error:', error);
      yield {
        type: 'error',
        error: error.message || 'Agent execution failed'
      };
    }
  }

  /**
   * Create LangChain agent executor with Composio tools
   */
  private async createAgentExecutor(tools: any[]): Promise<AgentExecutor> {
    const systemPrompt = this.config.systemPrompt || this.getDefaultSystemPrompt();

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', systemPrompt],
      new MessagesPlaceholder('chat_history'),
      ['human', '{input}'],
      new MessagesPlaceholder('agent_scratchpad')
    ]);

    const agent = await createOpenAIFunctionsAgent({
      llm: this.llm,
      tools,
      prompt
    });

    return new AgentExecutor({
      agent,
      tools,
      maxIterations: this.config.maxIterations || 10,
      verbose: true,
      returnIntermediateSteps: true
    });
  }

  /**
   * Build agent input with conversation history
   */
  private buildAgentInput(
    message: string,
    conversationHistory: any[],
    fileContext?: string[]
  ): any {
    // Convert conversation history to LangChain messages
    const chatHistory = conversationHistory.map((msg: any) => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else if (msg.role === 'assistant') {
        return new AIMessage(msg.content);
      } else if (msg.role === 'system') {
        return new SystemMessage(msg.content);
      }
      return new HumanMessage(msg.content);
    });

    // Add file context to the message if present
    let enhancedMessage = message;
    if (fileContext && fileContext.length > 0) {
      enhancedMessage = `${message}\n\nContext from uploaded files:\n${fileContext.join('\n\n')}`;
    }

    return {
      input: enhancedMessage,
      chat_history: chatHistory
    };
  }

  /**
   * Get default system prompt with tool selection guidelines
   */
  private getDefaultSystemPrompt(): string {
    return `You are ArkAngel, an AI assistant with access to various productivity tools and integrations.

TOOL SELECTION GUIDELINES:
- Analyze user intent carefully before selecting tools
- Use Slack tools for team communication and messaging
- Use Notion/Linear/Asana for project management and task tracking
- Use GitHub/GitLab for code-related tasks and repositories
- Use Gmail/Outlook for email communication
- Use Google Calendar/Outlook Calendar for scheduling and meetings
- Use Google Drive/Dropbox for file storage and sharing
- Use Stripe for payment-related tasks
- For general questions or information requests, respond directly without tools

IMPORTANT RULES:
1. Only use tools when they are clearly needed for the user's request
2. If the user just wants information or conversation, DO NOT call tools
3. Be efficient - don't call multiple tools if one will suffice
4. Always explain what you're doing when you use a tool
5. If a tool fails, try to help the user anyway with available information

Be helpful, concise, and professional. Focus on solving the user's problem efficiently.`;
  }

  /**
   * Fallback: Direct LLM response without tools
   * Used when Composio is not configured or no tools are connected
   */
  private async *directLLMResponse(
    message: string,
    conversationHistory: any[],
    fileContext?: string[]
  ): AsyncGenerator<AgentChunk> {
    try {
      // Build messages
      const messages = [
        new SystemMessage(this.config.systemPrompt || this.getDefaultSystemPrompt())
      ];

      // Add conversation history
      for (const msg of conversationHistory) {
        if (msg.role === 'user') {
          messages.push(new HumanMessage(msg.content));
        } else if (msg.role === 'assistant') {
          messages.push(new AIMessage(msg.content));
        }
      }

      // Add current message with file context
      let enhancedMessage = message;
      if (fileContext && fileContext.length > 0) {
        enhancedMessage = `${message}\n\nContext from uploaded files:\n${fileContext.join('\n\n')}`;
      }
      messages.push(new HumanMessage(enhancedMessage));

      // Stream response
      const stream = await this.llm.stream(messages);

      for await (const chunk of stream) {
        const content = chunk.content;
        if (content && typeof content === 'string') {
          yield {
            type: 'text',
            content
          };
        }
      }

      yield { type: 'done' };
    } catch (error: any) {
      console.error('[SmartComposioAgent] Direct LLM error:', error);
      yield {
        type: 'error',
        error: error.message || 'LLM response failed'
      };
    }
  }

  /**
   * Check if tools should be used based on query
   * Quick pre-check before agent execution
   */
  private shouldUseTools(message: string): boolean {
    const lowerMessage = message.toLowerCase();

    // Keywords that suggest tool usage
    const toolKeywords = [
      'send', 'create', 'schedule', 'add', 'update', 'delete', 'search',
      'find', 'get', 'fetch', 'list', 'email', 'message', 'calendar',
      'meeting', 'document', 'file', 'task', 'issue', 'pr', 'pull request'
    ];

    // Keywords that suggest no tools needed
    const noToolKeywords = [
      'what is', 'who is', 'define', 'explain', 'how do', 'tell me about',
      'calculate', 'convert', 'translate'
    ];

    // Check for no-tool keywords first
    for (const keyword of noToolKeywords) {
      if (lowerMessage.includes(keyword)) {
        return false;
      }
    }

    // Check for tool keywords
    for (const keyword of toolKeywords) {
      if (lowerMessage.includes(keyword)) {
        return true;
      }
    }

    // Default to using tools if available
    return true;
  }
}
