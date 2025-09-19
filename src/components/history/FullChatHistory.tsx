import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Trash2,
  Calendar,
  Loader2,
  Search,
} from "lucide-react";
import { Popover, PopoverContent, PopoverAnchor, Button, ScrollArea, Input, SpotlightArea } from "@/components";
import { useWindowResize, useWindowFocus } from "@/hooks";
import { loadChatHistory, deleteConversation } from "@/lib";
import { ChatConversation } from "@/types";
import { summarizeChat } from "../summarize/summarizer";

interface FullChatHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation: (conversation: ChatConversation) => void;
  onNewConversation: () => void;
  currentConversationId: string | null;
}

export const FullChatHistory: React.FC<FullChatHistoryProps> = ({
  isOpen,
  onClose,
  onSelectConversation,
  onNewConversation,
  currentConversationId,
}) => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [summaries, setSummaries] = useState<Map<string, any>>(new Map());
  const { resizeWindow } = useWindowResize();

  // Load conversations when dialog opens
  useEffect(() => {
    if (isOpen) {
      const loadedConversations = loadChatHistory();
      // Sort by updatedAt descending
      const sortedConversations = [...loadedConversations].sort((a, b) => b.updatedAt - a.updatedAt);
      setConversations(sortedConversations);

      // Generate summaries for all conversations
      const newSummaries = new Map();
      sortedConversations.forEach(conversation => {
        const summary = summarizeChat(conversation);
        newSummaries.set(conversation.id, summary);
      });
      setSummaries(newSummaries);
    }
  }, [isOpen]);

  // Match ChatHistory: resize window when popover open state changes
  useEffect(() => {
    resizeWindow(isOpen);
  }, [isOpen, resizeWindow]);

  // Close when window focus is lost (like ChatHistory)
  useWindowFocus({
    onFocusLost: () => {
      onClose();
    },
  });

  const handleDeleteConversation = (
    conversationId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation(); // Prevent triggering conversation selection
    deleteConversation(conversationId);
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    setSummaries((prev) => {
      const newSummaries = new Map(prev);
      newSummaries.delete(conversationId);
      return newSummaries;
    });

    // Emit event to notify other components about deletion
    window.dispatchEvent(
      new CustomEvent("conversationDeleted", {
        detail: conversationId,
      })
    );
  };

  const handleSelectConversation = (conversation: ChatConversation) => {
    setSelectedConversationId(conversation.id);
    onSelectConversation(conversation);
    onClose();

    // Clear the selection after a short delay to show the loading state
    setTimeout(() => {
      setSelectedConversationId(null);
    }, 2000);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  const filteredConversations = conversations.filter(conversation => {
    if (!searchQuery) return true;
    const summary = summaries.get(conversation.id);
    const searchLower = searchQuery.toLowerCase();
    return (
      conversation.title.toLowerCase().includes(searchLower) ||
      summary?.oneSentenceSummary?.toLowerCase().includes(searchLower) ||
      conversation.messages.some(msg => msg.content.toLowerCase().includes(searchLower))
    );
  });

  // Date helpers for grouping
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const isYesterday = (d: Date) => {
    const now = new Date();
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return isSameDay(d, y);
  };

  const formatFullDate = (d: Date) =>
    d.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });

  // Group conversations: Today (no header), Yesterday, and other dates
  const now = new Date();
  const todayItems: ChatConversation[] = [];
  const yesterdayItems: ChatConversation[] = [];
  const otherGroups = new Map<string, { label: string; items: ChatConversation[]; sortKey: number }>();

  for (const c of filteredConversations) {
    const d = new Date(c.updatedAt);
    if (isSameDay(d, now)) {
      todayItems.push(c);
    } else if (isYesterday(d)) {
      yesterdayItems.push(c);
    } else {
      const keyDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const label = formatFullDate(d);
      const sortKey = keyDate.getTime();
      const existing = otherGroups.get(label);
      if (existing) {
        existing.items.push(c);
      } else {
        otherGroups.set(label, { label, items: [c], sortKey });
      }
    }
  }

  const sortedOtherGroups = Array.from(otherGroups.values()).sort((a, b) => b.sortKey - a.sortKey);

  // Ensure items within each group are sorted by recency (most recent first)
  todayItems.sort((a, b) => b.updatedAt - a.updatedAt);
  yesterdayItems.sort((a, b) => b.updatedAt - a.updatedAt);
  sortedOtherGroups.forEach((g) => {
    g.items.sort((a, b) => b.updatedAt - a.updatedAt);
  });

  // Render helper for a single conversation row (button)
  const renderConversationRow = (conversation: ChatConversation) => {
    const summary = summaries.get(conversation.id);
    return (
      <SpotlightArea as="button"
        key={conversation.id}
        className={`group w-full text-left p-4 rounded-lg border transition-all hover:bg-muted/50 ${
          conversation.id === currentConversationId
            ? "bg-muted border-primary/20"
            : "border-transparent hover:border-input/50"
        }`}
        onClick={() => handleSelectConversation(conversation)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-base font-medium truncate leading-6">
                {conversation.title}
              </h3>
              <div className="flex items-center gap-2">
                {selectedConversationId === conversation.id && (
                  <div className="flex items-center gap-1 text-blue-600">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs">Loading...</span>
                  </div>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="cursor-pointer h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  onClick={(e) => handleDeleteConversation(conversation.id, e)}
                  title="Delete conversation"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {summary && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground italic">
                  {summary.oneSentenceSummary}
                </p>

                {summary.chatOutline.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {summary.chatOutline.slice(0, 3).map((section: any, index: number) => (
                      <span
                        key={`section-${conversation.id}-${section.title}-${index}`}
                        className="text-xs bg-primary/10 text-primary px-2 py-1 rounded"
                      >
                        {section.title}
                      </span>
                    ))}
                    {summary.chatOutline.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{summary.chatOutline.length - 3} more sections
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(conversation.updatedAt)}</span>
              </div>
              <span>•</span>
              <span>{conversation.messages.length} messages</span>
              {summary?.chatOutline && (
                <>
                  <span>•</span>
                  <span>{summary.chatOutline.length} sections</span>
                </>
              )}
            </div>
          </div>
        </div>
      </SpotlightArea>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* Anchor near top-right like ChatHistory button */}
      <PopoverAnchor asChild>
        <div className="fixed top-2 right-2 w-0 h-0" />
      </PopoverAnchor>
      <PopoverContent
        align="end"
        side="bottom"
        className="select-none w-screen p-0 border overflow-hidden border-input/50"
        sideOffset={8}
      >
        <div className="border-b border-input/50 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              All Conversations
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button
                size="sm"
                onClick={() => {
                  onNewConversation();
                  onClose();
                }}
                className="text-xs"
              >
                New Chat
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Browse and search through all your conversations
          </p>
        </div>

        <ScrollArea className="h-[calc(100vh-8.75rem)]">
          <div className="p-6">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-lg text-muted-foreground">
                  {searchQuery ? "No conversations match your search" : "No conversations yet"}
                </p>
                <p className="text-sm text-muted-foreground/70 mt-2">
                  {searchQuery ? "Try a different search term" : "Start chatting to see your history here"}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Today (no section header) */}
                {todayItems.length > 0 && (
                  <div className="space-y-4">
                    {todayItems.map(renderConversationRow)}
                  </div>
                )}

                {/* Yesterday */}
                {yesterdayItems.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">Yesterday</h3>
                    <div className="space-y-4">
                      {yesterdayItems.map(renderConversationRow)}
                    </div>
                  </div>
                )}

                {/* Older dates */}
                {sortedOtherGroups.map((group) => (
                  <div key={group.label} className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground">{group.label}</h3>
                    <div className="space-y-4">
                      {group.items.map(renderConversationRow)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};