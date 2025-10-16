import { ChatConversation, ChatMessage } from '@/types';

export interface ChatSummary {
  title: string;
  oneSentenceSummary: string;
  bulletPoints: string[];
  chatOutline: ChatSection[];
}

export interface ChatSection {
  title: string;
  description: string;
  messageCount: number;
  keyTopics: string[];
}

/**
 * Analyzes a chat conversation and generates a summary with title and key points
 */
export function summarizeChat(conversation: ChatConversation): ChatSummary {
  const messages = conversation.messages;

  if (messages.length === 0) {
    return {
      title: 'Empty Conversation',
      oneSentenceSummary: 'This conversation contains no messages.',
      bulletPoints: ['No messages in this conversation'],
      chatOutline: []
    };
  }

  // Extract user messages for analysis
  const userMessages = messages.filter(msg => msg.role === 'user');
  const assistantMessages = messages.filter(msg => msg.role === 'assistant');

  // Generate title based on first user message or conversation content
  const title = generateTitle(userMessages, conversation.title);

  // Generate one-sentence summary
  const oneSentenceSummary = generateOneSentenceSummary(userMessages, assistantMessages);

  // Generate bullet points from key topics discussed
  const bulletPoints = generateBulletPoints(userMessages, assistantMessages);

  // Generate chat outline with sections
  const chatOutline = generateChatOutline(messages);

  return {
    title,
    oneSentenceSummary,
    bulletPoints,
    chatOutline
  };
}

/**
 * Generates a concise one-sentence summary of the conversation
 */
function generateOneSentenceSummary(userMessages: ChatMessage[], assistantMessages: ChatMessage[]): string {
  if (userMessages.length === 0) {
    return 'A conversation with no user input.';
  }

  const firstUserMessage = userMessages[0].content;
  const lastAssistantMessage = assistantMessages[assistantMessages.length - 1]?.content || '';

  // Extract main topic from first message
  const mainTopic = extractMainTopic(firstUserMessage);

  // Determine conversation type and outcome
  let summary = `A conversation about ${mainTopic}`;

  if (assistantMessages.length > 0) {
    if (lastAssistantMessage.includes('error') || lastAssistantMessage.includes('failed')) {
      summary += ' that encountered some issues.';
    } else if (lastAssistantMessage.includes('completed') || lastAssistantMessage.includes('finished')) {
      summary += ' that was successfully completed.';
    } else {
      summary += ' with detailed assistance provided.';
    }
  }

  return summary;
}

/**
 * Generates a chat outline with sections based on topic changes
 */
function generateChatOutline(messages: ChatMessage[]): ChatSection[] {
  if (messages.length === 0) return [];

  const sections: ChatSection[] = [];
  let currentSection: ChatSection | null = null;
  let sectionStartIndex = 0;

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    const topics = extractTopicsFromMessage(message);

    // Start new section if this is the first message or topic changed significantly
    if (!currentSection || hasTopicChanged(currentSection.keyTopics, topics)) {
      // Save previous section if it exists
      if (currentSection) {
        currentSection.messageCount = i - sectionStartIndex;
        sections.push(currentSection);
      }

      // Start new section
      currentSection = {
        title: generateSectionTitle(message, topics),
        description: generateSectionDescription(message),
        messageCount: 1,
        keyTopics: topics
      };
      sectionStartIndex = i;
    } else {
      // Add topics to current section
      currentSection.keyTopics = Array.from(new Set([...currentSection.keyTopics, ...topics]));
    }
  }

  // Add the last section
  if (currentSection) {
    currentSection.messageCount = messages.length - sectionStartIndex;
    sections.push(currentSection);
  }

  return sections;
}
function extractTopics(messages: ChatMessage[]): string[] {
  const topics: string[] = [];

  messages.forEach(message => {
    const content = message.content.toLowerCase();

    // Look for question patterns
    if (content.includes('how to') || content.includes('how do')) {
      topics.push('Technical guidance requested');
    }

    if (content.includes('explain') || content.includes('what is')) {
      topics.push('Explanations provided');
    }

    if (content.includes('help') || content.includes('assist')) {
      topics.push('Assistance requested');
    }

    if (content.includes('code') || content.includes('function') || content.includes('class')) {
      topics.push('Code-related discussion');
    }

    if (content.includes('error') || content.includes('bug') || content.includes('fix')) {
      topics.push('Problem solving');
    }

    if (content.includes('feature') || content.includes('implement')) {
      topics.push('Feature development');
    }

    // Extract key nouns/concepts (simple approach)
    const words = content.split(' ');
    const potentialTopics = words.filter(word =>
      word.length > 4 &&
      !['about', 'would', 'could', 'should', 'there', 'their', 'where', 'which', 'that', 'this', 'with', 'from', 'have', 'been', 'were', 'will', 'what', 'when'].includes(word)
    );

    if (potentialTopics.length > 0) {
      const topic = potentialTopics.slice(0, 3).join(' ');
      if (topic.length > 10) {
        topics.push(`Discussed: ${topic}`);
      }
    }
  });

  return Array.from(new Set(topics));
}

/**
 * Generates a concise title for the conversation
 */
function generateTitle(userMessages: ChatMessage[], existingTitle: string): string {
  // If there's already a meaningful title, use it
  if (existingTitle && existingTitle !== 'New Conversation' && existingTitle.length > 5) {
    return existingTitle;
  }

  if (userMessages.length === 0) {
    return 'Chat Summary';
  }

  // Use the first user message as basis for title
  const firstMessage = userMessages[0].content;

  // Extract key words from first message
  const words = firstMessage.split(' ').filter(word =>
    word.length > 3 && !['what', 'when', 'where', 'which', 'that', 'this', 'with', 'from', 'have', 'been', 'were', 'will', 'would', 'could', 'should', 'about', 'there', 'their', 'they', 'them'].includes(word.toLowerCase())
  );

  if (words.length >= 2) {
    return words.slice(0, 4).join(' ') + (words.length > 4 ? '...' : '');
  }

  return firstMessage.length > 50 ? firstMessage.substring(0, 47) + '...' : firstMessage;
}

/**
 * Extracts the main topic from a message
 */
function extractMainTopic(content: string): string {
  const words = content.toLowerCase().split(' ');
  const stopWords = ['what', 'when', 'where', 'which', 'that', 'this', 'with', 'from', 'have', 'been', 'were', 'will', 'would', 'could', 'should', 'about', 'there', 'their', 'they', 'them', 'how', 'can', 'do', 'does', 'is', 'are', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'by', 'as'];

  const meaningfulWords = words.filter(word =>
    word.length > 3 && !stopWords.includes(word)
  );

  if (meaningfulWords.length > 0) {
    return meaningfulWords.slice(0, 3).join(' ');
  }

  return 'general discussion';
}

/**
 * Extracts topics from a single message
 */
function extractTopicsFromMessage(message: ChatMessage): string[] {
  const content = message.content.toLowerCase();
  const topics: string[] = [];

  // Code-related topics
  if (content.includes('code') || content.includes('function') || content.includes('class') || content.includes('script')) {
    topics.push('Code Implementation');
  }

  // Error/problem topics
  if (content.includes('error') || content.includes('bug') || content.includes('fix') || content.includes('issue')) {
    topics.push('Problem Solving');
  }

  // Help/assistance topics
  if (content.includes('help') || content.includes('assist') || content.includes('guide')) {
    topics.push('Assistance Request');
  }

  // Explanation topics
  if (content.includes('explain') || content.includes('what is') || content.includes('how to')) {
    topics.push('Explanations');
  }

  // Feature development
  if (content.includes('feature') || content.includes('implement') || content.includes('add')) {
    topics.push('Feature Development');
  }

  return topics;
}

/**
 * Determines if topics have changed significantly
 */
function hasTopicChanged(existingTopics: string[], newTopics: string[]): boolean {
  if (existingTopics.length === 0 || newTopics.length === 0) return true;

  // If no overlap in topics, consider it a change
  const overlap = existingTopics.filter(topic => newTopics.includes(topic));
  return overlap.length === 0;
}

/**
 * Generates a title for a chat section
 */
function generateSectionTitle(message: ChatMessage, topics: string[]): string {
  if (topics.length > 0) {
    return topics[0];
  }

  // Fallback to first few words of the message
  const words = message.content.split(' ').slice(0, 4);
  return words.join(' ') + (message.content.split(' ').length > 4 ? '...' : '');
}

/**
 * Generates a description for a chat section
 */
function generateSectionDescription(message: ChatMessage): string {
  const content = message.content;
  if (content.length <= 100) {
    return content;
  }
  return content.substring(0, 97) + '...';
}

/**
 * Generates bullet points highlighting main topics discussed
 */
function generateBulletPoints(userMessages: ChatMessage[], assistantMessages: ChatMessage[]): string[] {
  const bulletPoints: string[] = [];

  // Analyze user questions/requests
  const userTopics = extractTopics(userMessages);
  const assistantTopics = extractTopics(assistantMessages);

  // Combine and deduplicate topics
  const allTopics = [...userTopics, ...assistantTopics];
  const uniqueTopics = Array.from(new Set(allTopics));

  // Create bullet points from topics
  uniqueTopics.slice(0, 8).forEach(topic => {
    bulletPoints.push(topic);
  });

  // If we don't have enough topics, add some general points
  if (bulletPoints.length < 3) {
    if (userMessages.length > 0) {
      bulletPoints.push(`Conversation with ${userMessages.length} user messages`);
    }
    if (assistantMessages.length > 0) {
      bulletPoints.push(`Received ${assistantMessages.length} assistant responses`);
    }
    bulletPoints.push(`Started on ${new Date(userMessages[0]?.timestamp || Date.now()).toLocaleDateString()}`);
  }

  return bulletPoints;
}