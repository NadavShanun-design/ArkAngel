import React, { useState, useEffect } from 'react';
import { Card, Button, ScrollArea } from '@/components';
import { ChatConversation } from '@/types';
import { summarizeChat, ChatSummary } from './summarizer';

interface SummarizeProps {
  conversation: ChatConversation | null;
  onClose?: () => void;
}

export const Summarize: React.FC<SummarizeProps> = ({ conversation, onClose }) => {
  const [summary, setSummary] = useState<ChatSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (conversation) {
      setIsLoading(true);
      // Generate summary
      const generatedSummary = summarizeChat(conversation);
      setSummary(generatedSummary);
      setIsLoading(false);
    } else {
      setSummary(null);
    }
  }, [conversation]);

  if (!conversation) {
    return (
      <Card className="p-4">
        <p className="text-muted-foreground">Select a conversation to summarize</p>
      </Card>
    );
  }

  const renderSummary = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2">Generating summary...</span>
        </div>
      );
    }

    if (!summary) {
      return <p className="text-muted-foreground">Unable to generate summary</p>;
    }

    return (
      <ScrollArea className="max-h-96">
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-base mb-2">Title:</h3>
            <p className="text-sm bg-muted p-2 rounded">{summary.title}</p>
          </div>

          <div>
            <h3 className="font-medium text-base mb-2">Summary:</h3>
            <p className="text-sm bg-muted p-2 rounded italic">{summary.oneSentenceSummary}</p>
          </div>

          <div>
            <h3 className="font-medium text-base mb-2">Key Points:</h3>
            <ul className="space-y-1">
              {summary.bulletPoints.map((point, index) => (
                <li key={`point-${index}-${point.slice(0, 10)}`} className="text-sm flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {summary.chatOutline.length > 0 && (
            <div>
              <h3 className="font-medium text-base mb-2">Chat Outline:</h3>
              <div className="space-y-3">
                {summary.chatOutline.map((section, index) => (
                  <div key={`section-${section.title}-${index}`} className="border-l-2 border-primary/20 pl-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">{section.title}</h4>
                      <span className="text-xs text-muted-foreground">
                        {section.messageCount} messages
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {section.description}
                    </p>
                    {section.keyTopics.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {section.keyTopics.slice(0, 3).map((topic, topicIndex) => (
                          <span
                            key={`topic-${topic}-${topicIndex}`}
                            className="text-xs bg-primary/10 text-primary px-2 py-1 rounded"
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    );
  };

  return (
    <Card className="p-4 max-w-2xl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Chat Summary</h2>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        )}
      </div>
      {renderSummary()}
    </Card>
  );
};
