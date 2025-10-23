import { UITarsAgentService } from './agent.js';
import type { ExecuteCommandRequest, ExecuteCommandResponse } from './types.js';
import { validateApiKey } from './validator.js';

const agent = new UITarsAgentService();

// Listen for commands via stdin
process.stdin.setEncoding('utf8');

let inputBuffer = '';

process.stdin.on('data', async (chunk: string) => {
  inputBuffer += chunk;

  const lines = inputBuffer.split('\n');
  inputBuffer = lines.pop() || '';

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const request: ExecuteCommandRequest = JSON.parse(line);

      // Special command: validate API key
      if (request.instruction === '__VALIDATE_API__') {
        console.log('[Service] Validating API key...');
        const validation = await validateApiKey(request.config);

        const validationResponse: ExecuteCommandResponse = {
          success: validation.success,
          message: validation.success
            ? `✅ ${validation.details}`
            : `❌ ${validation.error}: ${validation.details}`,
          status: validation.success ? 'completed' : 'error',
          error: validation.error,
        };

        process.stdout.write(JSON.stringify(validationResponse) + '\n');
        continue;
      }

      // Send initial status update
      const startResponse: ExecuteCommandResponse = {
        success: true,
        message: '🚀 Starting agent execution...',
        status: 'running',
      };
      process.stdout.write(JSON.stringify(startResponse) + '\n');

      await agent.executeCommand(
        request.instruction,
        request.config,
        (response: ExecuteCommandResponse) => {
          // Send updates to stdout
          console.log('[Service] Sending update:', response.status, response.thought?.substring(0, 50));
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      );
    } catch (error) {
      const errorResponse: ExecuteCommandResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to parse command',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  }
});

process.stdin.on('end', () => {
  agent.stop();
  process.exit(0);
});

// Handle termination signals
process.on('SIGINT', () => {
  agent.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  agent.stop();
  process.exit(0);
});

// Send ready signal
const readySignal: ExecuteCommandResponse = {
  success: true,
  message: 'UI-TARS service ready',
  status: 'completed',
};
process.stdout.write(JSON.stringify(readySignal) + '\n');
