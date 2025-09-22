import { useState, useEffect } from "react";
import { File } from "lucide-react";
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
  conversation_id?: string | null;
}

export const FileUploadSettings = ({ showHeader = true }: { showHeader?: boolean }) => {
  const [uploadedFiles, setUploadedFiles] = useState<FileInfo[]>([]);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      console.log('[FileUpload] Loading files…');
      const files = await invoke<FileInfo[]>('list_uploaded_files');
      console.log('[FileUpload] Loaded', files?.length ?? 0, 'files');
      setUploadedFiles(files);
    } catch (error) {
      console.error('Failed to load files:', error);
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
          <h4 className="text-sm font-medium">File Uploads</h4>
          <p className="text-xs text-muted-foreground">
            View uploaded files that provide context for AI conversations
          </p>
        </div>
      )}

      {/* File List (collapsible) */}
      {uploadedFiles.length > 0 && (
        <details className="w-full">
          <summary className="text-xs font-medium text-muted-foreground cursor-pointer select-none">
            Uploaded Files ({uploadedFiles.length})
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
                  <span className={`text-xs px-2 py-1 rounded ${file.is_context_enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                    {file.is_context_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Manage Data Section - Moved to main settings */}
      {/* Previously had SpotlightArea here, now in settings/index.tsx */}
    </div>
  );
};
