import React, { useState, useEffect, useRef } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { Terminal, Trash2, Download, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LogEntry {
  timestamp: Date;
  level: 'info' | 'debug' | 'warn' | 'error' | 'success';
  source: string;
  message: string;
  details?: any;
}

interface LogViewerProps {
  title?: string;
  maxLogs?: number;
  showControls?: boolean;
  height?: string;
  eventChannel?: string; // Optional custom event channel to listen to
}

export const LogViewer: React.FC<LogViewerProps> = ({
  title = 'System Logs',
  maxLogs = 1000,
  showControls = true,
  height = '400px',
  eventChannel = 'app_log',
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Listen for log events from Tauri backend
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const setupListener = async () => {
      unlisten = await listen<{
        level: string;
        source: string;
        message: string;
        details?: any;
      }>(eventChannel, (event) => {
        const newLog: LogEntry = {
          timestamp: new Date(),
          level: event.payload.level as any || 'info',
          source: event.payload.source || 'System',
          message: event.payload.message,
          details: event.payload.details,
        };

        setLogs((prev) => {
          const updated = [...prev, newLog];
          // Keep only the last maxLogs entries
          if (updated.length > maxLogs) {
            return updated.slice(-maxLogs);
          }
          return updated;
        });
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [eventChannel, maxLogs]);

  const clearLogs = () => {
    setLogs([]);
  };

  const copyLogsToClipboard = async () => {
    const logText = logs
      .map((log) => {
        const time = log.timestamp.toLocaleTimeString();
        let details = '';
        if (log.details) {
          details = '\n  ' + JSON.stringify(log.details, null, 2).replace(/\n/g, '\n  ');
        }
        return `[${time}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}${details}`;
      })
      .join('\n');

    try {
      await navigator.clipboard.writeText(logText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy logs:', err);
    }
  };

  const downloadLogs = () => {
    const logText = logs
      .map((log) => {
        const time = log.timestamp.toISOString();
        return `[${time}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}${
          log.details ? '\n' + JSON.stringify(log.details, null, 2) : ''
        }`;
      })
      .join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arkangel-logs-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'text-red-500';
      case 'warn':
        return 'text-yellow-500';
      case 'success':
        return 'text-green-500';
      case 'debug':
        return 'text-gray-500';
      default:
        return 'text-blue-500';
    }
  };

  const getLevelBg = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'bg-red-500/10 border-red-500/20';
      case 'warn':
        return 'bg-yellow-500/10 border-yellow-500/20';
      case 'success':
        return 'bg-green-500/10 border-green-500/20';
      case 'debug':
        return 'bg-gray-500/10 border-gray-500/20';
      default:
        return 'bg-blue-500/10 border-blue-500/20';
    }
  };

  return (
    <div className="flex flex-col border border-input/50 rounded-lg overflow-hidden bg-background/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-input/50 bg-muted/30">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">{title}</h3>
          <span className="text-xs text-muted-foreground">
            ({logs.length} {logs.length === 1 ? 'entry' : 'entries'})
          </span>
        </div>

        {showControls && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="w-3 h-3"
              />
              Auto-scroll
            </label>
            <Button
              onClick={copyLogsToClipboard}
              size="sm"
              variant="ghost"
              className="h-7 px-2"
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
            <Button onClick={downloadLogs} size="sm" variant="ghost" className="h-7 px-2">
              <Download className="w-3 h-3" />
            </Button>
            <Button onClick={clearLogs} size="sm" variant="ghost" className="h-7 px-2">
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Logs Container */}
      <div
        ref={containerRef}
        className="overflow-y-auto font-mono text-xs p-2 space-y-1"
        style={{ height, maxHeight: height }}
      >
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>No logs yet. Waiting for activity...</p>
          </div>
        ) : (
          logs.map((log, idx) => (
            <div
              key={idx}
              className={`p-2 rounded border ${getLevelBg(log.level)} hover:bg-accent/10 transition-colors`}
            >
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground whitespace-nowrap">
                  {log.timestamp.toLocaleTimeString()}
                </span>
                <span className={`font-semibold uppercase whitespace-nowrap ${getLevelColor(log.level)}`}>
                  [{log.level}]
                </span>
                <span className="text-primary font-medium whitespace-nowrap">
                  [{log.source}]
                </span>
                <span className="flex-1 break-words">{log.message}</span>
              </div>
              {log.details && (
                <pre className="mt-1 pl-4 text-muted-foreground text-xs overflow-x-auto">
                  {typeof log.details === 'string'
                    ? log.details
                    : JSON.stringify(log.details, null, 2)}
                </pre>
              )}
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};
