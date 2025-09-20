import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import http from 'http'

export class MCPServerManager {
  private static instance: MCPServerManager
  private proc: ChildProcessWithoutNullStreams | null = null
  private readonly url = 'http://127.0.0.1:8000/mcp'

  static getInstance(): MCPServerManager {
    if (!MCPServerManager.instance) MCPServerManager.instance = new MCPServerManager()
    return MCPServerManager.instance
  }

  isRunning(): boolean {
    return !!this.proc && !this.proc.killed
  }

  async start(): Promise<void> {
    if (this.isRunning()) return

    const appData = process.env.APPDATA || process.env.HOME || process.cwd()
    const credsDir = `${appData.replace(/\\$/, '')}\\ArkAngel\\google_oauth\\credentials`

    const env = {
      ...process.env,
      // Use the exact environment variable names from the reference repo
      GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID || '
      GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '
      GOOGLE_MCP_CREDENTIALS_DIR: process.env.GOOGLE_MCP_CREDENTIALS_DIR || credsDir,
      LOG_LEVEL: process.env.LOG_LEVEL || 'DEBUG',
      // Dev only; production should use HTTPS
      OAUTHLIB_INSECURE_TRANSPORT: process.env.OAUTHLIB_INSECURE_TRANSPORT || '1',
      // Additional environment variables from reference repo
      WORKSPACE_MCP_BASE_URI: 'http://localhost',
      WORKSPACE_MCP_PORT: '8000',
      MCP_ENABLE_OAUTH21: 'true',
      WORKSPACE_MCP_STATELESS_MODE: 'false'
    }

    console.log('[MCPServerManager] Spawning workspace-mcp (HTTP)...')
    console.log('[MCPServerManager] Environment:', {
      GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID || '
      GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '
      GOOGLE_MCP_CREDENTIALS_DIR: env.GOOGLE_MCP_CREDENTIALS_DIR,
      MCP_ENABLE_OAUTH21: env.MCP_ENABLE_OAUTH21
    })
    console.log('[MCPServerManager] Full environment variables:', {
      GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID || '
      GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '
    })
    
    const args = ['workspace-mcp', '--transport', 'streamable-http', '--tool-tier', 'complete']
    const isWindows = process.platform === 'win32'
    const primaryCmd = isWindows ? 'uvx.cmd' : 'uvx'
    const fallbackCmd = isWindows ? 'python' : 'python3'

    console.log('[MCPServerManager] Spawn details:', {
      cwd: process.cwd(),
      platform: process.platform,
      primaryCmd,
      fallbackCmd,
      PATH: process.env.PATH
    })

    const spawnWith = (command: string, commandArgs: string[]) => {
      try {
        const proc = spawn(command, commandArgs, {
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: isWindows // helps resolve .cmd on Windows PATH reliably
        })
        proc.stdout.on('data', d => process.stdout.write(`[workspace-mcp] ${d}`))
        proc.stderr.on('data', d => process.stderr.write(`[workspace-mcp:err] ${d}`))
        proc.on('exit', code => {
          console.log(`[MCPServerManager] workspace-mcp exited with code ${code}`)
          this.proc = null
        })
        proc.on('error', (err) => {
          console.error('[MCPServerManager] ❌ Spawn error:', err?.message)
        })
        return proc
      } catch (e: any) {
        console.error('[MCPServerManager] ❌ Synchronous spawn threw:', e?.message)
        return null as any
      }
    }

    // Try primary spawn first
    this.proc = spawnWith(primaryCmd, args)

    // If primary immediately died, attempt python -m uvx fallback
    // Give a very short delay to detect immediate spawn failures
    await new Promise(r => setTimeout(r, 300))
    if (this.proc && this.proc.killed) {
      console.warn('[MCPServerManager] Primary spawn appears killed; attempting python -m uvx fallback...')
      this.proc = spawnWith(fallbackCmd, ['-m', 'uvx', ...args])
    }
    if (!this.proc) {
      console.warn('[MCPServerManager] Primary spawn failed; attempting python -m uvx fallback...')
      this.proc = spawnWith(fallbackCmd, ['-m', 'uvx', ...args])
    }

    // wait for readiness
    await this.waitForReady(30_000)
  }

  async stop(): Promise<void> {
    if (!this.proc) return
    try {
      this.proc.kill('SIGTERM')
    } catch {}
    this.proc = null
  }

  private async waitForReady(timeoutMs: number): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const ok = await this.tryProbe()
      if (ok) return
      await new Promise(r => setTimeout(r, 1000))
    }
    console.warn('[MCPServerManager] Timed out waiting for workspace-mcp readiness')
  }

  private tryProbe(): Promise<boolean> {
    return new Promise(resolve => {
      console.log('[MCPServerManager] 🔍 Probing MCP server at:', this.url)
      const req = http.get(this.url, res => {
        console.log('[MCPServerManager] 📡 Probe response:', res.statusCode, res.statusMessage)
        // 406 Not Acceptable is common for /mcp without proper Accept header; treat as ready
        const isReady = res.statusCode !== undefined
        console.log('[MCPServerManager] ✅ Server ready:', isReady)
        resolve(isReady)
        res.resume()
      })
      req.on('error', (err) => {
        console.log('[MCPServerManager] ❌ Probe error:', err.message)
        resolve(false)
      })
      req.setTimeout(2000, () => {
        console.log('[MCPServerManager] ⏰ Probe timeout')
        try { req.destroy() } catch {}
        resolve(false)
      })
    })
  }
}


