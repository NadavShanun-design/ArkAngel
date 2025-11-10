import React, { useEffect, useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Button, ScrollArea } from "@/components";
import { cn } from "@/lib/utils";
import { Image as ImageIcon, Trash2, Plus, AlertCircle, Loader2 } from "lucide-react";
import type { ScreenshotInfo, AddToTrainingResult } from "@/types/workflows";

export const WorkflowsPage: React.FC = () => {
  const [screenshots, setScreenshots] = useState<ScreenshotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addingToTraining, setAddingToTraining] = useState<string | null>(null);

  // Load screenshots on mount
  useEffect(() => {
    loadScreenshots();
  }, []);

  const loadScreenshots = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await invoke<ScreenshotInfo[]>("get_all_screenshots");
      setScreenshots(data);
      console.log(`[Workflows] Loaded ${data.length} screenshots`);
    } catch (err) {
      console.error("[Workflows] Failed to load screenshots:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this screenshot? This cannot be undone.")) {
      return;
    }

    try {
      await invoke("delete_screenshot", { screenshotId: id });
      setScreenshots((prev) => prev.filter((s) => s.id !== id));
      console.log(`[Workflows] Deleted screenshot: ${id}`);
    } catch (err) {
      console.error("[Workflows] Failed to delete:", err);
      alert(`Failed to delete: ${err}`);
    }
  };

  const handleAddToTraining = async (screenshot: ScreenshotInfo) => {
    // Get API key from localStorage
    const apiKey = localStorage.getItem("openai-api-key");
    if (!apiKey) {
      alert("Please set your OpenAI API key in Settings first.");
      return;
    }

    const confirmMessage = `Generate caption for this screenshot?\n\nEstimated cost: $0.0002\nProvider: GPT-4o-mini`;
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setAddingToTraining(screenshot.id);
      console.log(`[Workflows] Adding screenshot ${screenshot.id} to training...`);

      const result = await invoke<AddToTrainingResult>("add_screenshot_to_training", {
        screenshotId: screenshot.id,
        apiKey,
        provider: "openai",
      });

      console.log(`[Workflows] Caption generated:`, result);
      console.log(`[Workflows] Cost: $${result.cost.toFixed(6)}`);

      // Update local state
      setScreenshots((prev) =>
        prev.map((s) =>
          s.id === screenshot.id
            ? { ...s, added_to_training: true, training_added_at: new Date().toISOString() }
            : s
        )
      );

      alert(
        `Screenshot added to training!\n\nTokens used: ${result.tokens_used}\nCost: $${result.cost.toFixed(6)}\n\nCaption preview:\n${result.caption.substring(0, 200)}...`
      );
    } catch (err) {
      console.error("[Workflows] Failed to add to training:", err);
      alert(`Failed to add to training: ${err}`);
    } finally {
      setAddingToTraining(null);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const totalSize = screenshots.reduce((sum, s) => sum + s.file_size, 0);
    const inTraining = screenshots.filter((s) => s.added_to_training).length;
    return {
      total: screenshots.length,
      inTraining,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(1),
    };
  }, [screenshots]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading screenshots...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <h2 className="text-lg font-semibold">Failed to Load Screenshots</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={loadScreenshots}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-input/50 bg-background/60 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ImageIcon className="h-6 w-6" />
              Workflow Screenshots
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.total} screenshot{stats.total !== 1 ? "s" : ""} · {stats.inTraining} in
              training · {stats.totalSizeMB} MB
            </p>
          </div>
          <Button onClick={loadScreenshots} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </header>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {screenshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ImageIcon className="h-16 w-16 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium mb-2">No screenshots yet</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Screenshots are automatically captured when you submit prompts in chat. Start a
                conversation to capture your first workflow!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {screenshots.map((screenshot) => (
                <div
                  key={screenshot.id}
                  className={cn(
                    "border border-input/50 rounded-lg overflow-hidden bg-card hover:border-input transition-all cursor-pointer",
                    selectedId === screenshot.id ? "ring-2 ring-primary" : ""
                  )}
                  onClick={() => setSelectedId(screenshot.id)}
                >
                  {/* Image */}
                  <div className="relative aspect-video bg-muted/30">
                    <img
                      src={convertFileSrc(screenshot.file_path)}
                      alt={`Screenshot from ${formatTimestamp(screenshot.timestamp)}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {screenshot.added_to_training && (
                      <div className="absolute top-2 right-2 bg-green-500/90 text-white text-xs px-2 py-1 rounded">
                        ✓ In Training
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatTimestamp(screenshot.timestamp)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {screenshot.width}×{screenshot.height}
                      </span>
                      <span>{formatFileSize(screenshot.file_size)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToTraining(screenshot);
                        }}
                        disabled={screenshot.added_to_training || addingToTraining === screenshot.id}
                      >
                        {addingToTraining === screenshot.id ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Adding...
                          </>
                        ) : screenshot.added_to_training ? (
                          "✓ Added"
                        ) : (
                          <>
                            <Plus className="h-3 w-3 mr-1" />
                            Add to Training
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(screenshot.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
