import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { loadChatHistory, deleteConversation, clearChatHistory } from "../../lib/storage";
import { ChatConversation } from "../../types/completion";
import { Trash2, History, Loader2 } from "lucide-react";
// Use a dynamic import to avoid bundling/typing issues when not running in Tauri
const safeInvoke = async <T = unknown>(
  command: string,
  args?: Record<string, unknown>
): Promise<T | null> => {
  // Attempt to import the Tauri core module
  let mod: any;
  try {
    // eslint-disable-next-line no-new-func
    const dynamicImport = new Function("m", "return import(m)");
    mod = await dynamicImport("@tauri-apps/api/core");
  } catch (e) {
    console.warn(`Tauri core unavailable; skipping invoke(${command})`, e);
    return null;
  }
  try {
    const result = await mod.invoke(command, args);
    return result as T;
  } catch (err) {
    console.error(`invoke(${command}) failed:`, err);
    throw err;
  }
};

// Safe import for dialog
const safeAsk = async (message: string, options?: any): Promise<boolean> => {
  try {
    // eslint-disable-next-line no-new-func
    const dynamicImport = new Function("m", "return import(m)");
    const dialogMod = await dynamicImport("@tauri-apps/plugin-dialog");
    return await dialogMod.ask(message, options);
  } catch (e) {
    console.warn(`Tauri dialog unavailable; using fallback`, e);
    // Fallback to a simple confirm if available
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return window.confirm(message);
    }
    return true;
  }
};

export const ChatHistorySettings = () => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [isWiping, setIsWiping] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);

  useEffect(() => {
    refresh();
    void refreshUploads();
  }, []);

  const refresh = () => {
    const items = loadChatHistory();
    // sort by updatedAt desc
    const sorted = [...items].sort((a, b) => b.updatedAt - a.updatedAt);
    setConversations(sorted);
  };

  const refreshUploads = async () => {
    try {
      const files = await safeInvoke<{ id: string }[]>("list_uploaded_files");
      setUploadCount(files?.length ?? 0);
    } catch (e) {
      console.error('Failed to refresh uploads:', e);
      setUploadCount(0);
    }
  };

  const handleDeleteOne = (id: string) => {
    safeAsk("Delete this conversation and its uploaded files permanently?", {
      title: "Confirm Delete",
      kind: "warning",
    }).then((ok) => {
      if (!ok) return;
      deleteConversation(id);
      // Also delete any uploaded files associated with this conversation (if any)
      safeInvoke<number>("delete_files_by_conversation", { conversation_id: id }).then(() => {
        // Notify other panels to refresh uploads view
        try {
          window.dispatchEvent(new CustomEvent('uploads:changed'));
        } catch {}
      }).catch((e) => console.error('Failed to delete files by conversation:', e));
      refresh();
      void refreshUploads();
    }).catch((e) => console.error('Dialog failed:', e));
  };

  const handleWipeAll = async () => {
    const ok = await safeAsk("This will permanently delete all chat history and uploaded files on this device. Continue?", {
      title: "Confirm Wipe All Data",
      kind: "warning",
    });
    if (!ok) return;
    setIsWiping(true);
    try {
      // Wipe uploaded files (via Tauri)
      await safeInvoke("wipe_uploaded_files");

      clearChatHistory();
      setConversations([]);
      setUploadCount(0);
      try { window.dispatchEvent(new CustomEvent('uploads:changed')); } catch {}
    } catch (err) {
      console.error('Failed to wipe files:', err);
      alert('Failed to wipe files. See console for details.');
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h4 className="text-sm font-medium">Chat History</h4>
        <p className="text-xs text-muted-foreground">Review and manage stored conversations and uploaded files on this device.</p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={handleWipeAll}
          disabled={isWiping || (conversations.length === 0 && uploadCount === 0)}
        >
          {isWiping ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Wiping all data…
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-2" />
              Wipe All Chats & Files
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
            {conversations.map((c: ChatConversation) => (
              <div key={c.id} className="flex items-start justify-between p-2 border rounded-lg text-xs">
                <div className="flex items-start space-x-2 flex-1 min-w-0">
                  <History className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate leading-tight">{c.title || 'Untitled conversation'}</p>
                    <ConversationFileMeta conversationId={c.id} updatedAt={c.updatedAt} />
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

// Lightweight inline component to show per-conversation file count
const ConversationFileMeta = ({ conversationId, updatedAt }: { conversationId: string; updatedAt: number }) => {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const n = await safeInvoke<number>("count_files_by_conversation", { conversation_id: conversationId });
        if (mounted) setCount(n ?? 0);
      } catch (e) {
        console.error('Failed to count files:', e);
        if (mounted) setCount(0);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [conversationId]);
  let fileSuffix = "";
  if (count !== null) {
    let plural = "s";
    if (count === 1) plural = "";
    fileSuffix = `• ${count} file${plural}`;
  }
  return (
    <p className="text-[10px] text-muted-foreground leading-tight">
      Updated {new Date(updatedAt).toLocaleString()} {fileSuffix}
    </p>
  );
};
