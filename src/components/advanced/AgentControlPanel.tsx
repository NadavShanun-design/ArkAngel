import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export const AgentControlPanel = () => {
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [permissions, setPermissions] = useState<any>(null);
  const [config, setConfig] = useState({
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1'
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkPermissions();
    checkAgentStatus();
  }, []);

  const checkPermissions = async () => {
    try {
      console.log('[AgentControl] Checking permissions...');
      const perms = await invoke('check_agent_permissions');
      setPermissions(perms);
      console.log('[AgentControl] Permissions:', perms);
    } catch (error) {
      console.error('[AgentControl] Failed to check permissions:', error);
    }
  };

  const checkAgentStatus = async () => {
    try {
      const running = await invoke('get_agent_status');
      setIsAgentRunning(running as boolean);
      console.log('[AgentControl] Agent running:', running);
    } catch (error) {
      console.error('[AgentControl] Failed to check status:', error);
    }
  };

  const startAgent = async () => {
    if (!config.apiKey.trim()) {
      alert('❌ Please enter an API key');
      return;
    }

    setIsLoading(true);
    try {
      console.log('[AgentControl] Starting agent...');
      const result = await invoke('start_agent', {
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl
      });
      console.log('[AgentControl] Started:', result);
      alert('✅ Agent started successfully!\n\n' + result);
      setIsAgentRunning(true);
    } catch (error) {
      console.error('[AgentControl] Start failed:', error);
      alert('❌ Error starting agent:\n\n' + error);
    } finally {
      setIsLoading(false);
    }
  };

  const stopAgent = async () => {
    setIsLoading(true);
    try {
      console.log('[AgentControl] Stopping agent...');
      await invoke('stop_agent');
      console.log('[AgentControl] Agent stopped');
      alert('✅ Agent stopped successfully');
      setIsAgentRunning(false);
    } catch (error) {
      console.error('[AgentControl] Stop failed:', error);
      alert('❌ Error stopping agent:\n\n' + error);
    } finally {
      setIsLoading(false);
    }
  };

  const testConfig = async () => {
    if (!config.apiKey.trim()) {
      alert('❌ Please enter an API key to test');
      return;
    }

    setIsLoading(true);
    try {
      console.log('[AgentControl] Testing configuration...');
      const result = await invoke('test_agent', {
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl
      });
      alert('✅ Configuration test passed!\n\n' + result);
    } catch (error) {
      alert('❌ Configuration test failed:\n\n' + error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          🤖 UI-TARS Computer Control Agent
        </h2>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          isAgentRunning
            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
        }`}>
          {isAgentRunning ? '🟢 Running' : '⚫ Stopped'}
        </span>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        AI-powered agent that can control your computer through natural language commands using screen capture and input control.
      </p>

      {/* Permission Status */}
      {permissions && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <h3 className="font-semibold mb-3 text-yellow-900 dark:text-yellow-100 flex items-center gap-2">
            <span>⚠️</span>
            <span>Required Permissions & Setup</span>
          </h3>

          <div className="space-y-3">
            {/* Node.js Status */}
            {permissions.node && (
              <div className="p-3 bg-white dark:bg-gray-800 rounded border border-yellow-100 dark:border-yellow-900">
                <div className="flex items-start gap-2">
                  <span className="text-lg">{permissions.node.status === 'available' ? '✅' : '❌'}</span>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900 dark:text-white">Node.js</p>
                    <pre className="text-xs mt-1 whitespace-pre-wrap text-gray-700 dark:text-gray-300 font-mono">
                      {permissions.node.instruction}
                    </pre>
                    {permissions.node.version && permissions.node.version !== 'not_installed' && (
                      <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                        Version: {permissions.node.version}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Screen Recording Permission */}
            {permissions.screenRecording && permissions.screenRecording.required && (
              <div className="p-3 bg-white dark:bg-gray-800 rounded border border-yellow-100 dark:border-yellow-900">
                <div className="flex items-start gap-2">
                  <span className="text-lg">📹</span>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900 dark:text-white">Screen Recording Permission</p>
                    <pre className="text-xs mt-1 whitespace-pre-wrap text-gray-700 dark:text-gray-300 font-mono">
                      {permissions.screenRecording.instruction}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Accessibility Permission */}
            {permissions.accessibility && permissions.accessibility.required && (
              <div className="p-3 bg-white dark:bg-gray-800 rounded border border-yellow-100 dark:border-yellow-900">
                <div className="flex items-start gap-2">
                  <span className="text-lg">♿</span>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900 dark:text-white">Accessibility Permission</p>
                    <pre className="text-xs mt-1 whitespace-pre-wrap text-gray-700 dark:text-gray-300 font-mono">
                      {permissions.accessibility.instruction}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>

          {permissions.note && (
            <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded text-xs text-yellow-800 dark:text-yellow-200">
              <strong>Note:</strong> {permissions.note}
            </div>
          )}
        </div>
      )}

      {/* Agent Configuration */}
      <div className="space-y-4 mb-6">
        <h3 className="font-semibold text-gray-900 dark:text-white">Agent Configuration</h3>

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            Provider
          </label>
          <select
            value={config.provider}
            onChange={(e) => setConfig({ ...config, provider: e.target.value })}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={isLoading}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="groq">Groq (Ultra-Fast)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            API Key
          </label>
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="sk-..."
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Your API key is used locally and never stored permanently
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            Model
          </label>
          <input
            value={config.model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="gpt-4o-mini"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            Base URL
          </label>
          <input
            value={config.baseUrl}
            onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="https://api.openai.com/v1"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={testConfig}
          disabled={isLoading}
          className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Testing...' : 'Test Configuration'}
        </button>
        {isAgentRunning ? (
          <button
            onClick={stopAgent}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Stopping...' : 'Stop Agent'}
          </button>
        ) : (
          <button
            onClick={startAgent}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Starting...' : 'Start Agent'}
          </button>
        )}
        <button
          onClick={checkPermissions}
          disabled={isLoading}
          className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Refresh Status
        </button>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h4 className="font-semibold text-sm mb-2 text-blue-900 dark:text-blue-100">
          ℹ️ How to Use UI-TARS
        </h4>
        <ol className="text-xs space-y-1 text-blue-800 dark:text-blue-200 list-decimal list-inside">
          <li>Grant macOS permissions (Screen Recording & Accessibility) in System Settings</li>
          <li>Ensure Node.js is installed (check status above)</li>
          <li>Enter your AI provider API key</li>
          <li>Click "Test Configuration" to verify setup</li>
          <li>Click "Start Agent" to begin computer control</li>
          <li>Use natural language commands to control your computer</li>
        </ol>
      </div>

      {/* Warning */}
      <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded text-xs text-orange-800 dark:text-orange-200">
        <strong>⚠️ Early Stage Technology:</strong> UI-TARS is in active development (v0.2.4). Some features may be unstable. Use with caution and monitor agent actions carefully.
      </div>
    </div>
  );
};
