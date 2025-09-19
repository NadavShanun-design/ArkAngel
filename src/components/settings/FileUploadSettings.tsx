import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { File, Trash2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface FileInfo {
  id: string;
  name: string;
  file_type: string;
  size: number;
  upload_date: string;
  content: string;
  is_context_enabled: boolean;
  summary?: string;
}

type FileUploadSettingsProps = {
  showHeader?: boolean;
  refreshKey?: unknown;
};

export const FileUploadSettings = ({ showHeader = true, refreshKey }: FileUploadSettingsProps) => {
  const [uploadedFiles, setUploadedFiles] = useState<FileInfo[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadFiles();
  }, []);

  // Refresh when parent dialog opens/closes
  useEffect(() => {
    if (refreshKey !== undefined) {
      void loadFiles();
    }
  }, [refreshKey]);

  const loadFiles = async () => {
    try {
      console.log('[ManageData] Loading files…');
      const files = await invoke<FileInfo[]>('list_uploaded_files');
      console.log('[ManageData] Loaded', files?.length ?? 0, 'files');
      setUploadedFiles(files);
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      console.log('[ManageData] Delete file clicked', fileId);
      const ok = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm("Delete this file permanently?")
        : true;
      if (!ok) return;
      console.log('[ManageData] Deleting file via tauri', fileId);
      await invoke('delete_uploaded_file', { file_id: fileId });
      await loadFiles();
      console.log('[ManageData] Delete completed');
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete file. See console for details.');
    }
  };

  const handleToggleContext = async (fileId: string) => {
    try {
      console.log('[ManageData] Toggle context clicked', fileId);
      await invoke('toggle_file_context', { file_id: fileId });
      await loadFiles();
      console.log('[ManageData] Toggle completed');
    } catch (error) {
      console.error('Toggle context failed:', error);
      alert('Failed to toggle file context. See console for details.');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Unknown date';
    }
  };

  return (
    <div className="space-y-3">
      {/* Header Section (optional) */}
      {showHeader && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium">Uploaded Files</h4>
          <p className="text-xs text-muted-foreground">Review and manage files stored on this device. You can attach new files from the attachment button in the main UI.</p>
        </div>
      )}
      
      {/* Wipe All */}
      <div>
        <Button 
          type="button"
          onClick={async () => {
            const ok = typeof window !== 'undefined' && typeof window.confirm === 'function'
              ? window.confirm("This will permanently delete all uploaded files. Continue?")
              : true;
            if (!ok) return;
            try {
              setBusy(true);
              console.log('[ManageData] Wipe all files via tauri');
              await invoke('wipe_uploaded_files');
              await loadFiles();
              console.log('[ManageData] Wipe completed');
            } catch (error) {
              console.error('Wipe files failed:', error);
              alert('Failed to wipe files. See console for details.');
            } finally {
              setBusy(false);
            }
          }}
          variant="destructive"
          disabled={uploadedFiles.length === 0 || busy}
          className="w-full"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Wipe Files
        </Button>
      </div>

      {/* File List (collapsible) */}
      {uploadedFiles.length > 0 && (
        <details className="w-full" open>
          <summary className="text-xs font-medium text-muted-foreground cursor-pointer select-none">
            Files ({uploadedFiles.length})
          </summary>
          <div className="space-y-1 mt-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-start justify-between p-2 border rounded-lg text-xs"
              >
                <div className="flex items-start space-x-2 flex-1 min-w-0">
                  <File className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate leading-tight">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      {formatFileSize(file.size)} • {formatDate(file.upload_date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                  <input
                    type="checkbox"
                    checked={file.is_context_enabled}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (busy) return;
                      void handleToggleContext(file.id);
                    }}
                    className="h-3 w-3"
                    title={file.is_context_enabled ? "Disable context" : "Enable context"}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (busy) return;
                      void handleDeleteFile(file.id);
                    }}
                    className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                    title="Delete file"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};
