import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { loadChatHistory, deleteConversation, clearChatHistory } from "@/lib";
import { ChatConversation } from "@/types";
import { Trash2, History, Loader2 } from "lucide-react";

export const ChatHistorySettings = () => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [isWiping, setIsWiping] = useState(false);

  useEffect(() => {
    refresh();
  }, []);

  const refresh = () => {
    const items = loadChatHistory();
    // sort by updatedAt desc
    const sorted = [...items].sort((a, b) => b.updatedAt - a.updatedAt);
    setConversations(sorted);
  };

  const handleDeleteOne = (id: string) => {
    if (!confirm("Delete this conversation permanently?")) return;
    deleteConversation(id);
    refresh();
  };

  const handleWipeAll = async () => {
    if (!confirm("This will permanently delete all chat history. Continue?")) return;
    setIsWiping(true);
    try {
      clearChatHistory();
      setConversations([]);
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h4 className="text-sm font-medium">Chat History</h4>
        <p className="text-xs text-muted-foreground">Review and manage stored conversations on this device.</p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={handleWipeAll}
          disabled={isWiping || conversations.length === 0}
        >
          {isWiping ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Wiping all chats…
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-2" />
              Wipe All Chats
            </>
          )}
        </Button>
      </div>

      {conversations.length > 0 && (
        <details className="w-full">
          <summary className="text-xs font-medium text-muted-foreground cursor-pointer select-none">
            Conversations ({conversations.length})
          </summary>
          <div className="space-y-1 mt-2">
            {conversations.map((c) => (
              <div key={c.id} className="flex items-start justify-between p-2 border rounded-lg text-xs">
                <div className="flex items-start space-x-2 flex-1 min-w-0">
                  <History className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate leading-tight">{c.title || 'Untitled conversation'}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Updated {new Date(c.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteOne(c.id)}
                    className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                    title="Delete conversation"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {conversations.length === 0 && (
        <p className="text-xs text-muted-foreground">No stored conversations yet.</p>
      )}
    </div>
  );
};
