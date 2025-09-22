import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ChatSession, ChatMessage } from './chat-logger.js';

export interface TranscriptFile {
  filename: string;
  date: string;
  time: string;
  sessionId: string;
  messageCount: number;
  filePath: string;
}

export class TranscriptStorage {
  private static instance: TranscriptStorage;
  private readonly transcriptsDir: string;
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB max file size
  private initialized = false;

  private constructor() {
    // Set transcripts directory relative to the main ArkAngel folder
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    this.transcriptsDir = path.join(__dirname, '..', '..', 'transcripts');
    // Remove top-level side effect - will initialize lazily
  }

  public static getInstance(): TranscriptStorage {
    if (!TranscriptStorage.instance) {
      TranscriptStorage.instance = new TranscriptStorage();
    }
    return TranscriptStorage.instance;
  }

  /**
   * Initialize the transcripts directory (lazy initialization)
   */
  private async ensureTranscriptsDirectory(): Promise<void> {
    if (this.initialized) return;
    
    try {
      if (!fs.existsSync(this.transcriptsDir)) {
        fs.mkdirSync(this.transcriptsDir, { recursive: true });
        console.log(`[TranscriptStorage] Created transcripts directory: ${this.transcriptsDir}`);
      }
      this.initialized = true;
    } catch (error) {
      console.error('[TranscriptStorage] Error creating transcripts directory:', error);
    }
  }

  /**
   * Ensure a date-specific directory exists
   */
  private async ensureDateDirectory(date: string): Promise<string> {
    await this.ensureTranscriptsDirectory();
    
    const dateDir = path.join(this.transcriptsDir, date);
    try {
      if (!fs.existsSync(dateDir)) {
        fs.mkdirSync(dateDir, { recursive: true });
        console.log(`[TranscriptStorage] Created date directory: ${dateDir}`);
      }
      return dateDir;
    } catch (error) {
      console.error(`[TranscriptStorage] Error creating date directory ${dateDir}:`, error);
      return this.transcriptsDir; // Fallback to main directory
    }
  }

  /**
   * Generate a filename for a transcript
   */
  private generateFilename(sessionId: string, timestamp: Date): string {
    const timeStr = timestamp.toTimeString().split(' ')[0].replace(/:/g, '-');
    return `transcript_${timeStr}_${sessionId.substring(0, 8)}.txt`;
  }

  /**
   * Format a chat session into a readable transcript
   */
  private formatTranscript(session: ChatSession): string {
    const date = session.startTime.toLocaleDateString();
    const startTime = session.startTime.toLocaleTimeString();
    const endTime = session.lastActivity.toLocaleTimeString();
    const messageCount = session.messages.length;

    let transcript = '';
    transcript += '='.repeat(80) + '\n';
    transcript += 'CONVERSATION TRANSCRIPT\n';
    transcript += '='.repeat(80) + '\n';
    transcript += `Date: ${date}\n`;
    transcript += `Start Time: ${startTime}\n`;
    transcript += `End Time: ${endTime}\n`;
    transcript += `Session ID: ${session.id}\n`;
    transcript += `Total Messages: ${messageCount}\n`;
    transcript += '='.repeat(80) + '\n\n';

    // Group messages by conversation flow
    let currentSpeaker: 'user' | 'ai' | null = null;
    let messageBuffer = '';

    for (const message of session.messages) {
      const timestamp = message.timestamp.toLocaleTimeString();
      
      // If speaker changed, flush buffer and start new section
      if (currentSpeaker !== message.type) {
        if (messageBuffer.trim()) {
          transcript += messageBuffer + '\n';
          messageBuffer = '';
        }
        
        transcript += `[${timestamp}] ${message.type.toUpperCase()}: `;
        currentSpeaker = message.type;
      } else {
        // Same speaker, continue on new line
        transcript += '\n';
      }

      // Add message content
      messageBuffer += message.content;
    }

    // Flush any remaining buffer
    if (messageBuffer.trim()) {
      transcript += messageBuffer + '\n';
    }

    transcript += '\n' + '='.repeat(80) + '\n';
    transcript += 'END OF CONVERSATION\n';
    transcript += '='.repeat(80) + '\n';

    return transcript;
  }

  /**
   * Save a chat session as a transcript file
   */
  public async saveTranscript(session: ChatSession): Promise<TranscriptFile | null> {
    try {
      if (session.messages.length === 0) {
        console.log(`[TranscriptStorage] Skipping empty session ${session.id}`);
        return null;
      }

      const date = session.startTime.toISOString().split('T')[0]; // YYYY-MM-DD format
      const dateDir = await this.ensureDateDirectory(date);
      const filename = this.generateFilename(session.id, session.startTime);
      const filePath = path.join(dateDir, filename);
      
      const transcript = this.formatTranscript(session);
      
      // Check file size before writing
      if (transcript.length > this.maxFileSize) {
        console.warn(`[TranscriptStorage] Transcript too large (${transcript.length} bytes), truncating...`);
        const truncatedTranscript = transcript.substring(0, this.maxFileSize) + '\n\n[TRUNCATED DUE TO SIZE LIMIT]';
        fs.writeFileSync(filePath, truncatedTranscript, 'utf8');
      } else {
        fs.writeFileSync(filePath, transcript, 'utf8');
      }

      const transcriptFile: TranscriptFile = {
        filename,
        date,
        time: session.startTime.toTimeString().split(' ')[0],
        sessionId: session.id,
        messageCount: session.messages.length,
        filePath
      };

      console.log(`[TranscriptStorage] Saved transcript: ${filename} (${session.messages.length} messages)`);
      return transcriptFile;

    } catch (error) {
      console.error(`[TranscriptStorage] Error saving transcript for session ${session.id}:`, error);
      return null;
    }
  }

  /**
   * Save multiple sessions as transcript files
   */
  public async saveMultipleTranscripts(sessions: ChatSession[]): Promise<TranscriptFile[]> {
    const results: TranscriptFile[] = [];
    
    for (const session of sessions) {
      const result = await this.saveTranscript(session);
      if (result) {
        results.push(result);
      }
    }

    console.log(`[TranscriptStorage] Saved ${results.length} transcript files`);
    return results;
  }

  /**
   * List all available transcript files
   */
  public async listTranscripts(): Promise<TranscriptFile[]> {
    const transcripts: TranscriptFile[] = [];

    try {
      await this.ensureTranscriptsDirectory();
      
      if (!fs.existsSync(this.transcriptsDir)) {
        return transcripts;
      }

      const dateDirs = fs.readdirSync(this.transcriptsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .sort();

      for (const dateDir of dateDirs) {
        const datePath = path.join(this.transcriptsDir, dateDir);
        const files = fs.readdirSync(datePath)
          .filter(file => file.endsWith('.txt'))
          .sort();

        for (const file of files) {
          const filePath = path.join(datePath, file);
          const stats = fs.statSync(filePath);
          
          // Extract time and session ID from filename
          const match = file.match(/transcript_(\d{2}-\d{2}-\d{2})_(.+)\.txt/);
          const time = match ? match[1].replace(/-/g, ':') : '00:00:00';
          const sessionId = match ? match[2] : 'unknown';

          transcripts.push({
            filename: file,
            date: dateDir,
            time,
            sessionId,
            messageCount: 0, // Would need to parse file to get exact count
            filePath
          });
        }
      }

    } catch (error) {
      console.error('[TranscriptStorage] Error listing transcripts:', error);
    }

    return transcripts;
  }

  /**
   * Read a specific transcript file
   */
  public async readTranscript(filename: string, date: string): Promise<string | null> {
    try {
      await this.ensureTranscriptsDirectory();
      
      const filePath = path.join(this.transcriptsDir, date, filename);
      
      if (!fs.existsSync(filePath)) {
        console.error(`[TranscriptStorage] Transcript file not found: ${filePath}`);
        return null;
      }

      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      console.error(`[TranscriptStorage] Error reading transcript ${filename}:`, error);
      return null;
    }
  }

  /**
   * Delete a transcript file
   */
  public async deleteTranscript(filename: string, date: string): Promise<boolean> {
    try {
      await this.ensureTranscriptsDirectory();
      
      const filePath = path.join(this.transcriptsDir, date, filename);
      
      if (!fs.existsSync(filePath)) {
        console.error(`[TranscriptStorage] Transcript file not found: ${filePath}`);
        return false;
      }

      fs.unlinkSync(filePath);
      console.log(`[TranscriptStorage] Deleted transcript: ${filename}`);
      return true;
    } catch (error) {
      console.error(`[TranscriptStorage] Error deleting transcript ${filename}:`, error);
      return false;
    }
  }

  /**
   * Get storage statistics
   */
  public async getStorageStats(): Promise<{ totalFiles: number; totalSize: number; oldestFile: string | null; newestFile: string | null }> {
    const transcripts = await this.listTranscripts();
    let totalSize = 0;
    let oldestFile: string | null = null;
    let newestFile: string | null = null;

    for (const transcript of transcripts) {
      try {
        const stats = fs.statSync(transcript.filePath);
        totalSize += stats.size;

        if (!oldestFile || stats.birthtime < fs.statSync(path.join(this.transcriptsDir, oldestFile.split('/')[0], oldestFile.split('/')[1])).birthtime) {
          oldestFile = `${transcript.date}/${transcript.filename}`;
        }

        if (!newestFile || stats.birthtime > fs.statSync(path.join(this.transcriptsDir, newestFile.split('/')[0], newestFile.split('/')[1])).birthtime) {
          newestFile = `${transcript.date}/${transcript.filename}`;
        }
      } catch (error) {
        console.error(`[TranscriptStorage] Error getting stats for ${transcript.filename}:`, error);
      }
    }

    return {
      totalFiles: transcripts.length,
      totalSize,
      oldestFile,
      newestFile
    };
  }
}
