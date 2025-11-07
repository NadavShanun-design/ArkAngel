import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { MinusIcon, XIcon } from "lucide-react";

export const WindowControls = () => {
  const win = getCurrentWebviewWindow();

  return (
    <div className="absolute right-3 top-4 -translate-y-1/2 flex gap-2">
      <button
        onClick={() => win.minimize()}
        className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted/50"
        title="Minimize"
      >
        <MinusIcon className="h-4 w-4" />
      </button>
      <button
        onClick={() => win.close()}
        className="h-6 w-6 flex items-center justify-center rounded hover:bg-red-500/70 hover:text-white"
        title="Close"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
};
