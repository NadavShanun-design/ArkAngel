import fs from 'fs';
import path from 'path';

export interface GoogleOAuthStatus {
  connected: boolean;
  email?: string;
  scopes?: string[];
  expiresAt?: Date;
}

export class GoogleOAuthChecker {
  private static instance: GoogleOAuthChecker;

  static getInstance(): GoogleOAuthChecker {
    if (!GoogleOAuthChecker.instance) {
      GoogleOAuthChecker.instance = new GoogleOAuthChecker();
    }
    return GoogleOAuthChecker.instance;
  }

  /**
   * Check Google OAuth connection status
   */
  async checkStatus(): Promise<GoogleOAuthStatus> {
    try {
      // First check if OAuth credentials are configured
      if (!this.isConfigured()) {
        return { connected: false };
      }

      // Check for credentials in the MCP credential store
      const credentialsDir = this.getCredentialsDir();
      const credentials = await this.findCredentials(credentialsDir);
      
      if (!credentials) {
        // No credentials found - user is not connected
        console.log(`[GoogleOAuth] OAuth configured but no credentials found - user not connected`);
        return { connected: false };
      }

      // Check if token is expired
      const isExpired = this.isTokenExpired(credentials);
      if (isExpired) {
        console.log(`[GoogleOAuth] Token expired - user needs to reconnect`);
        return { connected: false };
      }

      return {
        connected: true,
        email: credentials.email,
        scopes: credentials.scopes,
        expiresAt: credentials.expiresAt
      };

    } catch (error) {
      console.error(`[GoogleOAuth] Error checking status:`, error);
      // If there's an error, return not connected
      return { connected: false };
    }
  }

  /**
   * Get credentials directory path
   */
  private getCredentialsDir(): string {
    const envDir = process.env.GOOGLE_MCP_CREDENTIALS_DIR;
    if (envDir && envDir.trim()) {
      return envDir;
    }

    const home = process.env.HOME || process.env.USERPROFILE || '';
    if (home) {
      return path.join(home, '.google_workspace_mcp', 'credentials');
    }

    return path.join(process.cwd(), '.credentials');
  }

  /**
   * Find credentials file
   */
  private async findCredentials(credentialsDir: string): Promise<any> {
    try {
      if (!fs.existsSync(credentialsDir)) {
        return null;
      }

      const files = fs.readdirSync(credentialsDir).filter(f => f.endsWith('.json'));
      if (files.length === 0) {
        return null;
      }

      // Find the first valid credentials file
      for (const file of files) {
        const filePath = path.join(credentialsDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const credentials = JSON.parse(content);
          
          if (credentials.token && credentials.expiry) {
            return {
              email: file.replace('.json', ''),
              scopes: credentials.scopes || [],
              expiresAt: new Date(credentials.expiry),
              token: credentials.token
            };
          }
        } catch (error) {
          console.warn(`[GoogleOAuth] Invalid credentials file: ${file}`);
          continue;
        }
      }

      return null;
    } catch (error) {
      console.error(`[GoogleOAuth] Error reading credentials:`, error);
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(credentials: any): boolean {
    if (!credentials.expiresAt) {
      return true; // Assume expired if no expiry info
    }

    const now = new Date();
    const expiresAt = new Date(credentials.expiresAt);
    
    // Add 5 minute buffer to avoid edge cases
    const buffer = 5 * 60 * 1000; // 5 minutes in milliseconds
    return now.getTime() > (expiresAt.getTime() - buffer);
  }

  /**
   * Get Google OAuth client ID from environment
   */
  getClientId(): string | null {
    return process.env.GOOGLE_OAUTH_CLIENT_ID || null;
  }

  /**
   * Get Google OAuth client secret from environment
   */
  getClientSecret(): string | null {
    return process.env.GOOGLE_OAUTH_CLIENT_SECRET || null;
  }

  /**
   * Check if OAuth credentials are configured
   */
  isConfigured(): boolean {
    return !!(this.getClientId() && this.getClientSecret());
  }

  /**
   * Disconnect from Google OAuth by revoking tokens and clearing credentials
   */
  async disconnect(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[GoogleOAuth] Starting disconnect process...');
      
      // Get credentials directory
      const credentialsDir = this.getCredentialsDir();
      
      // Find and revoke tokens
      const credentials = await this.findCredentials(credentialsDir);
      if (credentials && credentials.token) {
        try {
          // Revoke the token with Google
          const response = await fetch('https://oauth2.googleapis.com/revoke', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `token=${encodeURIComponent(credentials.token)}`
          });
          
          if (response.ok) {
            console.log('[GoogleOAuth] Token revoked successfully');
          } else {
            console.warn('[GoogleOAuth] Token revocation failed:', response.status);
          }
        } catch (error) {
          console.warn('[GoogleOAuth] Token revocation error:', error);
        }
      }
      
      // Clear all credential files
      if (fs.existsSync(credentialsDir)) {
        const files = fs.readdirSync(credentialsDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          const filePath = path.join(credentialsDir, file);
          try {
            fs.unlinkSync(filePath);
            console.log(`[GoogleOAuth] Removed credential file: ${file}`);
          } catch (error) {
            console.warn(`[GoogleOAuth] Failed to remove credential file ${file}:`, error);
          }
        }
      }
      
      console.log('[GoogleOAuth] Disconnect completed successfully');
      return {
        success: true,
        message: 'Successfully disconnected from Google Suite'
      };
      
    } catch (error) {
      console.error('[GoogleOAuth] Disconnect error:', error);
      return {
        success: false,
        message: `Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}
