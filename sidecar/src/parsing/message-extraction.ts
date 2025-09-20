/**
 * Extract the actual user message from a raw message that may contain context preamble
 * This fixes the bug where context lines like "- ISO Timestamp: ..." are mistaken for user input
 */

export function extractUserMessage(raw: string): string {
  if (!raw) return ''

  // 1) Remove EXACTLY the "CURRENT DATE & TIME CONTEXT" block (dotall + multiline)
  // Matches from the header line through the end of the block up to a blank line or end.
  const withoutContext = raw.replace(
    /^CURRENT DATE\s*&\s*TIME\s*CONTEXT:[\r\n]+(?:^- .*(?:\r?\n|$))+(\r?\n|$)/ims,
    ''
  )

  // 2) Remove any stray "- Current Date/Time/ISO" bullets that escaped (defensive)
  const cleaned = withoutContext
    .replace(/^- (Current Date|Current Time|ISO Timestamp):.*$/gmi, '')
    .trim()

  // 3) If we accidentally stripped everything, fall back to the last non-empty line
  if (!cleaned) {
    const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    return lines.length ? lines[lines.length - 1] : ''
  }
  return cleaned
}

/**
 * Check if the cleaned user message needs MCP tools
 * Only use MCP for Google-related prompts when Google Suite is connected
 */
export function needsMCPTools(userText: string, googleConnected: boolean = false): boolean {
  if (!userText) return false
  
  const trimmed = userText.trim();
  
  // If Google Suite is not connected, never use MCP
  if (!googleConnected) {
    return false;
  }
  
  // Block trivial messages
  const trivialPattern = /^([.]|ok|yes|no|thanks|thank you|k|s|x|y|n|hi|hello|hey|yo)$/i;
  if (trivialPattern.test(trimmed) || trimmed.length <= 2) {
    return false;
  }
  
  // Only use MCP for Google-related prompts
  const googleKeywords = [
    'gmail', 'email', 'mail', 'inbox', 'message', 'messages',
    'calendar', 'event', 'events', 'meeting', 'schedule', 'appointment',
    'drive', 'file', 'files', 'document', 'documents', 'folder',
    'docs', 'sheets', 'slides', 'presentation', 'spreadsheet',
    'google', 'workspace', 'search', 'find'
  ];
  
  const lowerText = trimmed.toLowerCase();
  const hasGoogleKeywords = googleKeywords.some(keyword => lowerText.includes(keyword));
  
  return hasGoogleKeywords;
}
