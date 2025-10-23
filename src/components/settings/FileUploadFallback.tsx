import { useState, useRef } from "react";
import { Upload, FileText, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { invoke } from "@tauri-apps/api/core";

interface UploadResult {
  success: boolean;
  message: string;
  fileInfo?: {
    id: string;
    name: string;
    file_type: string;
    size: number;
    upload_date: string;
    content: string;
    is_context_enabled: boolean;
    summary: string;
  };
}

export const FileUploadFallback = () => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log("[FileUploadFallback] Starting file upload process...");
    setIsUploading(true);
    setUploadResult(null);

    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const fileData = Array.from(new Uint8Array(arrayBuffer));
      
      console.log("[FileUploadFallback] File read, uploading:", {
        name: file.name,
        size: file.size,
        type: file.type
      });
      
      // Upload the file using the backend command
      const uploadResult = await invoke<UploadResult['fileInfo']>('upload_file', {
        fileData,
        filename: file.name
      });

      setUploadResult({
        success: true,
        message: `Successfully uploaded "${file.name}"`,
        fileInfo: uploadResult
      });

      // Trigger UI refresh
      window.dispatchEvent(new CustomEvent('uploads:changed'));
      
      console.log("[FileUploadFallback] Upload completed successfully:", uploadResult);
    } catch (error) {
      console.error("[FileUploadFallback] Upload failed:", error);
      setUploadResult({
        success: false,
        message: `Upload failed: ${error}`
      });
    } finally {
      setIsUploading(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        accept=".pdf,.txt,.md,.json,.csv,.xml,.yaml,.yml,.log,.rtf,.py,.js,.ts,.jsx,.tsx,.java,.cpp,.c,.go,.rs,.php,.rb,.swift,.kt,.scala,.html,.htm,.css,.scss,.sass,.less,.sql,.sh,.bash,.zsh,.fish,.ps1,.bat,.cmd,.jpg,.jpeg,.png,.gif,.bmp,.webp,.svg"
        style={{ display: 'none' }}
      />

      {/* Upload Button */}
      <Button
        onClick={handleButtonClick}
        disabled={isUploading}
        className="w-full flex items-center justify-center gap-2"
        variant="outline"
      >
        {isUploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            Upload Documents
          </>
        )}
      </Button>

      {/* Upload Result */}
      {uploadResult && (
        <div className={`text-xs p-2 rounded-md border ${
          uploadResult.success 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-start gap-2">
            {uploadResult.success ? (
              <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
            ) : (
              <div className="h-3 w-3 mt-0.5 flex-shrink-0 rounded-full bg-red-500" />
            )}
            <div className="flex-1">
              <p className="font-medium">{uploadResult.message}</p>
              {uploadResult.fileInfo && (
                <div className="mt-1 text-xs opacity-75">
                  <p>Type: {uploadResult.fileInfo.file_type}</p>
                  <p>Size: {formatFileSize(uploadResult.fileInfo.size)}</p>
                  <p>Context: {uploadResult.fileInfo.is_context_enabled ? 'Enabled' : 'Disabled'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>• Supported formats: PDF, images, text, code, and data files</p>
        <p>• Files are stored locally and provide context for AI conversations</p>
        <p>• You can enable/disable individual files for context</p>
      </div>
    </div>
  );
};

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
