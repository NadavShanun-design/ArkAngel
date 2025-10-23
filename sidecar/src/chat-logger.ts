import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface ChatMessage {
  id: string;
  timestamp: Date;
  type: 'user' | 'ai';
  content: string;
  sessionId: string;
}

export interface ChatSession {
  id: string;
  startTime: Date;
  lastActivity: Date;
  messages: ChatMessage[];
}

export class ChatLogger {
  private static instance: ChatLogger;
  private sessions: Map<string, ChatSession> = new Map();
  private readonly MAX_SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_MESSAGES_PER_SESSION = 1000;

  private constructor() {
    // Start cleanup timer for old sessions
    setInterval(() => this.cleanupOldSessions(), 60 * 60 * 1000); // Every hour
  }

  public static getInstance(): ChatLogger {
    if (!ChatLogger.instance) {
      ChatLogger.instance = new ChatLogger();
    }
    return ChatLogger.instance;
  }

  /**
   * Middleware to log incoming chat requests
   */
  public logChatRequest() {
    return (req: Request, res: Response, next: NextFunction) => {
      const sessionId = this.getOrCreateSessionId(req);
      const userMessage: ChatMessage = {
        id: uuidv4(),
        timestamp: new Date(),
        type: 'user',
        content: req.body.message || req.body.content || '',
        sessionId
      };

      this.addMessageToSession(sessionId, userMessage);
      console.log(`[ChatLogger] Logged user message for session ${sessionId}`);
      next();
    };
  }

  /**
   * Middleware to log outgoing chat responses
   */
  public logChatResponse() {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;
      const sessionId = this.getOrCreateSessionId(req);

      res.send = function(body: any) {
        try {
          const responseData = typeof body === 'string' ? JSON.parse(body) : body;
          const aiMessage: ChatMessage = {
            id: uuidv4(),
            timestamp: new Date(),
            type: 'ai',
            content: responseData.response || responseData.content || responseData.message || '',
            sessionId
          };

          ChatLogger.getInstance().addMessageToSession(sessionId, aiMessage);
          console.log(`[ChatLogger] Logged AI response for session ${sessionId}`);
        } catch (error) {
          console.error('[ChatLogger] Error parsing response body:', error);
        }

        return originalSend.call(this, body);
      };

      next();
    };
  }

  /**
   * Get or create a session ID for the request
   */
  private getOrCreateSessionId(req: Request): string {
    // Try to get session ID from headers, query params, or body
    let sessionId = req.headers['x-session-id'] as string || 
                   req.query.sessionId as string || 
                   req.body.sessionId;

    if (!sessionId) {
      sessionId = uuidv4();
    }

    // Ensure session exists
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        id: sessionId,
        startTime: new Date(),
        lastActivity: new Date(),
        messages: []
      });
    }

    return sessionId;
  }

  /**
   * Add a message to a session
   */
  private addMessageToSession(sessionId: string, message: ChatMessage): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`[ChatLogger] Session ${sessionId} not found`);
      return;
    }

    session.messages.push(message);
    session.lastActivity = new Date();

    // Limit messages per session to prevent memory issues
    if (session.messages.length > this.MAX_MESSAGES_PER_SESSION) {
      session.messages = session.messages.slice(-this.MAX_MESSAGES_PER_SESSION);
    }
  }

  /**
   * Get all active sessions
   */
  public getActiveSessions(): ChatSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get a specific session by ID
   */
  public getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all messages for a session
   */
  public getSessionMessages(sessionId: string): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    return session ? session.messages : [];
  }

  /**
   * Clear a session (after transcript generation)
   */
  public clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    console.log(`[ChatLogger] Cleared session ${sessionId}`);
  }

  /**
   * Clean up old sessions to prevent memory leaks
   */
  private cleanupOldSessions(): void {
    const now = new Date();
    const sessionsToDelete: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime();
      if (timeSinceLastActivity > this.MAX_SESSION_DURATION) {
        sessionsToDelete.push(sessionId);
      }
    }

    sessionsToDelete.forEach(sessionId => {
      this.sessions.delete(sessionId);
      console.log(`[ChatLogger] Cleaned up old session ${sessionId}`);
    });

    if (sessionsToDelete.length > 0) {
      console.log(`[ChatLogger] Cleaned up ${sessionsToDelete.length} old sessions`);
    }
  }

  /**
   * Get statistics about logged conversations
   */
  public getStats(): { totalSessions: number; totalMessages: number; activeSessions: number } {
    const totalSessions = this.sessions.size;
    const totalMessages = Array.from(this.sessions.values())
      .reduce((sum, session) => sum + session.messages.length, 0);
    const activeSessions = Array.from(this.sessions.values())
      .filter(session => {
        const timeSinceLastActivity = new Date().getTime() - session.lastActivity.getTime();
        return timeSinceLastActivity < 30 * 60 * 1000; // Active in last 30 minutes
      }).length;

    return { totalSessions, totalMessages, activeSessions };
  }
}



