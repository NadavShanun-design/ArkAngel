import { ChatLogger, ChatSession } from './chat-logger.js';
import { TranscriptStorage, TranscriptFile } from './transcript-storage.js';

export interface TranscriptTimerStats {
  isRunning: boolean;
  lastRun: Date | null;
  nextRun: Date | null;
  totalRuns: number;
  totalTranscriptsGenerated: number;
  lastError: string | null;
}

export class TranscriptTimer {
  private static instance: TranscriptTimer;
  private timer: NodeJS.Timeout | null = null;
  private readonly intervalMs = 5 * 60 * 1000; // 5 minutes
  private isRunning = false;
  private lastRun: Date | null = null;
  private nextRun: Date | null = null;
  private totalRuns = 0;
  private totalTranscriptsGenerated = 0;
  private lastError: string | null = null;
  private chatLogger: ChatLogger;
  private transcriptStorage: TranscriptStorage;

  private constructor() {
    this.chatLogger = ChatLogger.getInstance();
    this.transcriptStorage = TranscriptStorage.getInstance();
    // No top-level side effects - timer will be started explicitly
  }

  public static getInstance(): TranscriptTimer {
    if (!TranscriptTimer.instance) {
      TranscriptTimer.instance = new TranscriptTimer();
    }
    return TranscriptTimer.instance;
  }

  /**
   * Start the transcript timer
   */
  public start(): void {
    if (this.isRunning) {
      console.log('[TranscriptTimer] Timer is already running');
      return;
    }

    this.isRunning = true;
    this.scheduleNextRun();
    
    // Run immediately on start
    this.generateTranscripts();
    
    console.log('[TranscriptTimer] Started - will generate transcripts every 5 minutes');
  }

  /**
   * Stop the transcript timer
   */
  public stop(): void {
    if (!this.isRunning) {
      console.log('[TranscriptTimer] Timer is not running');
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.isRunning = false;
    this.nextRun = null;
    console.log('[TranscriptTimer] Stopped');
  }

  /**
   * Schedule the next transcript generation
   */
  private scheduleNextRun(): void {
    if (!this.isRunning) return;

    this.timer = setTimeout(() => {
      this.generateTranscripts();
      this.scheduleNextRun(); // Schedule the next run
    }, this.intervalMs);

    this.nextRun = new Date(Date.now() + this.intervalMs);
  }

  /**
   * Generate transcripts for all active sessions
   */
  private async generateTranscripts(): Promise<void> {
    try {
      this.lastRun = new Date();
      this.totalRuns++;
      this.lastError = null;

      console.log(`[TranscriptTimer] Generating transcripts (run #${this.totalRuns})`);

      // Get all active sessions
      const activeSessions = this.chatLogger.getActiveSessions();
      
      if (activeSessions.length === 0) {
        console.log('[TranscriptTimer] No active sessions to process');
        return;
      }

      console.log(`[TranscriptTimer] Processing ${activeSessions.length} active sessions`);

      // Filter sessions that have messages and are worth saving
      const sessionsToProcess = activeSessions.filter(session => {
        const hasMessages = session.messages.length > 0;
        const isRecent = (Date.now() - session.lastActivity.getTime()) < 30 * 60 * 1000; // Active in last 30 minutes
        return hasMessages && isRecent;
      });

      if (sessionsToProcess.length === 0) {
        console.log('[TranscriptTimer] No sessions with recent activity to process');
        return;
      }

      console.log(`[TranscriptTimer] Saving ${sessionsToProcess.length} sessions with recent activity`);

      // Save transcripts for all sessions
      const savedTranscripts = await this.transcriptStorage.saveMultipleTranscripts(sessionsToProcess);
      this.totalTranscriptsGenerated += savedTranscripts.length;

      // Clear processed sessions from memory (but keep very recent ones)
      const cutoffTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      for (const session of sessionsToProcess) {
        if (session.lastActivity < cutoffTime) {
          this.chatLogger.clearSession(session.id);
        }
      }

      console.log(`[TranscriptTimer] Successfully generated ${savedTranscripts.length} transcript files`);
      console.log(`[TranscriptTimer] Total transcripts generated: ${this.totalTranscriptsGenerated}`);

    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      console.error('[TranscriptTimer] Error generating transcripts:', error);
    }
  }

  /**
   * Force immediate transcript generation (for testing or manual triggers)
   */
  public async forceGenerateTranscripts(): Promise<TranscriptFile[]> {
    console.log('[TranscriptTimer] Force generating transcripts...');
    
    try {
      const activeSessions = this.chatLogger.getActiveSessions();
      const sessionsToProcess = activeSessions.filter(session => session.messages.length > 0);
      
      if (sessionsToProcess.length === 0) {
        console.log('[TranscriptTimer] No sessions with messages to process');
        return [];
      }

      const savedTranscripts = await this.transcriptStorage.saveMultipleTranscripts(sessionsToProcess);
      
      // Clear all processed sessions
      for (const session of sessionsToProcess) {
        this.chatLogger.clearSession(session.id);
      }

      console.log(`[TranscriptTimer] Force generated ${savedTranscripts.length} transcript files`);
      return savedTranscripts;

    } catch (error) {
      console.error('[TranscriptTimer] Error in force generation:', error);
      throw error;
    }
  }

  /**
   * Get timer statistics
   */
  public getStats(): TranscriptTimerStats {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      nextRun: this.nextRun,
      totalRuns: this.totalRuns,
      totalTranscriptsGenerated: this.totalTranscriptsGenerated,
      lastError: this.lastError
    };
  }

  /**
   * Get detailed status information
   */
  public async getStatus(): Promise<string> {
    const stats = this.getStats();
    const chatStats = this.chatLogger.getStats();
    const storageStats = await this.transcriptStorage.getStorageStats();

    let status = '=== TRANSCRIPT TIMER STATUS ===\n';
    status += `Running: ${stats.isRunning ? 'YES' : 'NO'}\n`;
    status += `Last Run: ${stats.lastRun ? stats.lastRun.toLocaleString() : 'Never'}\n`;
    status += `Next Run: ${stats.nextRun ? stats.nextRun.toLocaleString() : 'Not scheduled'}\n`;
    status += `Total Runs: ${stats.totalRuns}\n`;
    status += `Total Transcripts Generated: ${stats.totalTranscriptsGenerated}\n`;
    
    if (stats.lastError) {
      status += `Last Error: ${stats.lastError}\n`;
    }

    status += '\n=== CHAT LOGGER STATS ===\n';
    status += `Active Sessions: ${chatStats.activeSessions}\n`;
    status += `Total Sessions: ${chatStats.totalSessions}\n`;
    status += `Total Messages: ${chatStats.totalMessages}\n`;

    status += '\n=== STORAGE STATS ===\n';
    status += `Total Files: ${storageStats.totalFiles}\n`;
    status += `Total Size: ${(storageStats.totalSize / 1024 / 1024).toFixed(2)} MB\n`;
    status += `Oldest File: ${storageStats.oldestFile || 'None'}\n`;
    status += `Newest File: ${storageStats.newestFile || 'None'}\n`;

    return status;
  }

  /**
   * Cleanup on shutdown
   */
  public shutdown(): void {
    console.log('[TranscriptTimer] Shutting down...');
    this.stop();
    
    // Generate final transcripts before shutdown
    this.forceGenerateTranscripts().catch(error => {
      console.error('[TranscriptTimer] Error during shutdown transcript generation:', error);
    });
  }
}
