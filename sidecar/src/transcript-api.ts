import { Request, Response } from 'express';
import { TranscriptStorage } from './transcript-storage.js';
import { TranscriptTimer } from './transcript-timer.js';
import { ChatLogger } from './chat-logger.js';

export class TranscriptAPI {
  private transcriptStorage: TranscriptStorage;
  private transcriptTimer: TranscriptTimer;
  private chatLogger: ChatLogger;

  constructor() {
    this.transcriptStorage = TranscriptStorage.getInstance();
    this.transcriptTimer = TranscriptTimer.getInstance();
    this.chatLogger = ChatLogger.getInstance();
  }

  /**
   * GET /api/transcripts - List all available transcripts
   */
  public listTranscripts = async (req: Request, res: Response): Promise<void> => {
    try {
      const transcripts = await this.transcriptStorage.listTranscripts();
      
      // Sort by date and time (newest first)
      transcripts.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.time.localeCompare(a.time);
      });

      res.json({
        success: true,
        count: transcripts.length,
        transcripts: transcripts.map(t => ({
          filename: t.filename,
          date: t.date,
          time: t.time,
          sessionId: t.sessionId,
          messageCount: t.messageCount
        }))
      });
    } catch (error) {
      console.error('[TranscriptAPI] Error listing transcripts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list transcripts'
      });
    }
  };

  /**
   * GET /api/transcripts/:date/:filename - Retrieve specific transcript
   */
  public getTranscript = async (req: Request, res: Response): Promise<void> => {
    try {
      const { date, filename } = req.params;
      
      if (!date || !filename) {
        res.status(400).json({
          success: false,
          error: 'Date and filename are required'
        });
        return;
      }

      const content = await this.transcriptStorage.readTranscript(filename, date);
      
      if (content === null) {
        res.status(404).json({
          success: false,
          error: 'Transcript not found'
        });
        return;
      }

      res.json({
        success: true,
        filename,
        date,
        content
      });
    } catch (error) {
      console.error('[TranscriptAPI] Error getting transcript:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve transcript'
      });
    }
  };

  /**
   * DELETE /api/transcripts/:date/:filename - Delete transcript file
   */
  public deleteTranscript = async (req: Request, res: Response): Promise<void> => {
    try {
      const { date, filename } = req.params;
      
      if (!date || !filename) {
        res.status(400).json({
          success: false,
          error: 'Date and filename are required'
        });
        return;
      }

      const success = await this.transcriptStorage.deleteTranscript(filename, date);
      
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Transcript not found or could not be deleted'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Transcript deleted successfully'
      });
    } catch (error) {
      console.error('[TranscriptAPI] Error deleting transcript:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete transcript'
      });
    }
  };

  /**
   * GET /api/transcripts/stats - Get transcript system statistics
   */
  public getStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const timerStats = this.transcriptTimer.getStats();
      const chatStats = this.chatLogger.getStats();
      const storageStats = await this.transcriptStorage.getStorageStats();

      res.json({
        success: true,
        stats: {
          timer: timerStats,
          chat: chatStats,
          storage: storageStats
        }
      });
    } catch (error) {
      console.error('[TranscriptAPI] Error getting stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get statistics'
      });
    }
  };

  /**
   * GET /api/transcripts/status - Get detailed system status
   */
  public getStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const status = await this.transcriptTimer.getStatus();
      
      res.json({
        success: true,
        status
      });
    } catch (error) {
      console.error('[TranscriptAPI] Error getting status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get status'
      });
    }
  };

  /**
   * POST /api/transcripts/generate - Force generate transcripts immediately
   */
  public forceGenerate = async (req: Request, res: Response): Promise<void> => {
    try {
      const transcripts = await this.transcriptTimer.forceGenerateTranscripts();
      
      res.json({
        success: true,
        message: `Generated ${transcripts.length} transcript files`,
        transcripts: transcripts.map(t => ({
          filename: t.filename,
          date: t.date,
          time: t.time,
          sessionId: t.sessionId,
          messageCount: t.messageCount
        }))
      });
    } catch (error) {
      console.error('[TranscriptAPI] Error force generating transcripts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate transcripts'
      });
    }
  };

  /**
   * POST /api/transcripts/timer/start - Start the transcript timer
   */
  public startTimer = (req: Request, res: Response): void => {
    try {
      this.transcriptTimer.start();
      
      res.json({
        success: true,
        message: 'Transcript timer started'
      });
    } catch (error) {
      console.error('[TranscriptAPI] Error starting timer:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start timer'
      });
    }
  };

  /**
   * POST /api/transcripts/timer/stop - Stop the transcript timer
   */
  public stopTimer = (req: Request, res: Response): void => {
    try {
      this.transcriptTimer.stop();
      
      res.json({
        success: true,
        message: 'Transcript timer stopped'
      });
    } catch (error) {
      console.error('[TranscriptAPI] Error stopping timer:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop timer'
      });
    }
  };

  /**
   * GET /api/transcripts/sessions - Get active chat sessions
   */
  public getActiveSessions = (req: Request, res: Response): void => {
    try {
      const sessions = this.chatLogger.getActiveSessions();
      
      res.json({
        success: true,
        count: sessions.length,
        sessions: sessions.map(session => ({
          id: session.id,
          startTime: session.startTime,
          lastActivity: session.lastActivity,
          messageCount: session.messages.length,
          duration: session.lastActivity.getTime() - session.startTime.getTime()
        }))
      });
    } catch (error) {
      console.error('[TranscriptAPI] Error getting active sessions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get active sessions'
      });
    }
  };

  /**
   * GET /api/transcripts/sessions/:sessionId - Get specific session details
   */
  public getSession = (req: Request, res: Response): void => {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: 'Session ID is required'
        });
        return;
      }

      const session = this.chatLogger.getSession(sessionId);
      
      if (!session) {
        res.status(404).json({
          success: false,
          error: 'Session not found'
        });
        return;
      }

      res.json({
        success: true,
        session: {
          id: session.id,
          startTime: session.startTime,
          lastActivity: session.lastActivity,
          messageCount: session.messages.length,
          messages: session.messages.map(msg => ({
            id: msg.id,
            timestamp: msg.timestamp,
            type: msg.type,
            content: msg.content
          }))
        }
      });
    } catch (error) {
      console.error('[TranscriptAPI] Error getting session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get session'
      });
    }
  };
}
