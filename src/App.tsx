import { useEffect, useState } from "react";
import { Card, Settings, Completion, ChatHistory, FullChatHistory, Integrations } from "./components";
import { ChatConversation } from "./types";
import { check } from "@tauri-apps/plugin-updater";
import { startRealTimeExport } from "./lib/storage";

const App = () => {
  const [isFullChatViewOpen, setIsFullChatViewOpen] = useState(false);
  const [isIntegrationsOpen, setIsIntegrationsOpen] = useState(false);
  const handleSelectConversation = (conversation: ChatConversation) => {
    // Use localStorage to communicate the selected conversation to Completion component
    localStorage.setItem("selectedConversation", JSON.stringify(conversation));
    // Trigger a custom event to notify Completion component
    window.dispatchEvent(
      new CustomEvent("conversationSelected", {
        detail: conversation,
      })
    );
  };

  // Check for updates
  useEffect(() => {
    check();
  }, []);

  // Start real-time export loop
  useEffect(() => {
    startRealTimeExport();
    
    // Cleanup on unmount
    return () => {
      // The stopRealTimeExport function will be called automatically
    };
  }, []);


  const handleNewConversation = () => {
    // Clear any selected conversation and trigger new conversation
    localStorage.removeItem("selectedConversation");
    window.dispatchEvent(new CustomEvent("newConversation"));
  };

  const handleViewAllChats = () => {
    setIsFullChatViewOpen(true);
  };

  const handleCloseFullChatView = () => {
    setIsFullChatViewOpen(false);
  };

  const handleOpenIntegrations = () => {
    setIsIntegrationsOpen(true);
  };

  const handleCloseIntegrations = () => {
    setIsIntegrationsOpen(false);
  };

  return (
    <div className="w-screen h-screen flex overflow-hidden justify-center items-start">
      <Card className="w-full flex flex-row items-center gap-2 p-2">
        <Completion />
        <ChatHistory
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          currentConversationId={null}
          onViewAllChats={handleViewAllChats}
        />
        <Settings onOpenIntegrations={handleOpenIntegrations} />
      </Card>

      {/* Render as separate panels below the toolbar */}
      <FullChatHistory
        isOpen={isFullChatViewOpen}
        onClose={handleCloseFullChatView}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        currentConversationId={null}
      />

      <Integrations isOpen={isIntegrationsOpen} onClose={handleCloseIntegrations} />
    </div>
  );
};

export default App;
