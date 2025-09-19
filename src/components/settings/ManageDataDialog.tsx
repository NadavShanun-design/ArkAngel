import { useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components";
import { FileUploadSettings } from "./FileUploadSettings";
import { ChatHistorySettings } from "./ChatHistorySettings";
import { Database } from "lucide-react";

export const ManageDataDialog = () => {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Database className="h-4 w-4 mr-2" /> Manage Data
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Data</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-semibold mb-2">Uploaded Files</h3>
            <FileUploadSettings showHeader={false} refreshKey={open} />
          </section>
          <section>
            <h3 className="text-sm font-semibold mb-2">Chats</h3>
            <ChatHistorySettings />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};
