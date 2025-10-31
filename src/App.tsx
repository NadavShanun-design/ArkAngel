import { useEffect } from "react";
import { Card, Settings, Completion, ChatHistory } from "./components";
import { ChatConversation } from "./types";
import { check } from "@tauri-apps/plugin-updater";
import { startRealTimeExport } from "./lib/storage";

// If you want to make ArkAngel to always stay on top, go to tauri.conf.json and change alwaysOnTop to true

const App = () => {
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

  return (
    <div className="w-screen h-screen flex overflow-hidden justify-center items-start">
      <Card
        className="flex flex-row items-center gap-2 p-2 drag-region w-full"
        data-tauri-drag-region
      >
        <Completion />
        <ChatHistory
          onSelectConversation={handleSelectConversation}
          onNewConversation={handleNewConversation}
          currentConversationId={null}
        />
        <Settings />
      </Card>
    </div>
  );
};

export default App;
