import { useEffect, useState } from "react";
import { Card, Settings, Completion, ChatHistory, FullChatHistory, Integrations } from "./components";
import { MinimizeOrb } from "./components/MinimizeOrb";
import { ChatConversation } from "./types";
import { check } from "@tauri-apps/plugin-updater";
import { startRealTimeExport } from "./lib/storage";
import { getCurrentWindow, LogicalSize, LogicalPosition } from "@tauri-apps/api/window";

const App = () => {
  const [isFullChatViewOpen, setIsFullChatViewOpen] = useState(false);
  const [isIntegrationsOpen, setIsIntegrationsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

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

  // Handle minimize/restore
  const handleMinimize = async () => {
    try {
      const window = getCurrentWindow();

      // Save current position before minimizing
      const currentPos = await window.outerPosition();
      localStorage.setItem('arkangel-window-position', JSON.stringify({ x: currentPos.x, y: currentPos.y }));

      // Resize to orb size
      await window.setSize(new LogicalSize(60, 60));

      setIsMinimized(true);
      localStorage.setItem('arkangel-minimized', 'true');
    } catch (error) {
      console.error('[MINIMIZE] Failed:', error);
    }
  };

  const handleRestore = async () => {
    try {
      const window = getCurrentWindow();

      // Restore to full size
      await window.setSize(new LogicalSize(700, 62));

      // Restore previous position if available
      const savedPosition = localStorage.getItem('arkangel-window-position');
      if (savedPosition) {
        const pos = JSON.parse(savedPosition);
        await window.setPosition(new LogicalPosition(pos.x, pos.y));
      }

      setIsMinimized(false);
      localStorage.setItem('arkangel-minimized', 'false');
    } catch (error) {
      console.error('[RESTORE] Failed:', error);
    }
  };

  // Load minimized state and position on mount
  useEffect(() => {
    const restoreWindowState = async () => {
      const savedMinimized = localStorage.getItem('arkangel-minimized');
      const savedPosition = localStorage.getItem('arkangel-window-position');
      const savedOrbPosition = localStorage.getItem('arkangel-orb-position');

      // Restore position first
      if (savedMinimized === 'true' && savedOrbPosition) {
        try {
          const pos = JSON.parse(savedOrbPosition);
          const window = getCurrentWindow();
          await window.setPosition(new LogicalPosition(pos.x, pos.y));
          setIsMinimized(true);
        } catch (error) {
          console.error('[RESTORE] Failed to restore orb position:', error);
        }
      } else if (savedPosition) {
        try {
          const pos = JSON.parse(savedPosition);
          const window = getCurrentWindow();
          await window.setPosition(new LogicalPosition(pos.x, pos.y));
        } catch (error) {
          console.error('[RESTORE] Failed to restore window position:', error);
        }
      }
    };

    restoreWindowState();
  }, []);

  // Expose minimize function globally
  useEffect(() => {
    (window as any).minimizeToOrb = handleMinimize;
  }, []);

  // Save window position when moved (for full window mode)
  useEffect(() => {
    if (isMinimized) return;

    let saveTimeout: NodeJS.Timeout;

    const savePosition = async () => {
      try {
        const window = getCurrentWindow();
        const pos = await window.outerPosition();
        localStorage.setItem('arkangel-window-position', JSON.stringify({ x: pos.x, y: pos.y }));
      } catch (error) {
        console.error('[POSITION] Failed to save position:', error);
      }
    };

    // Save position with debouncing to avoid too many saves during drag
    const handlePositionChange = () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(savePosition, 500);
    };

    // Listen for window move events
    const interval = setInterval(handlePositionChange, 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(saveTimeout);
    };
  }, [isMinimized]);

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

  // Handle window dragging with startDragging API
  const handleMouseDown = async (e: React.MouseEvent) => {
    // Only start dragging if clicking on the background, not on interactive elements
    const target = e.target as HTMLElement;

    // Check if clicked element or its parents are interactive
    const isInteractive = target.closest('button, input, textarea, select, a, [role="button"]');

    console.log('[DRAG] Mouse down:', {
      target: target.tagName,
      isInteractive: !!isInteractive,
      className: target.className
    });

    if (!isInteractive) {
      console.log('[DRAG] Starting window drag...');
      try {
        const window = getCurrentWindow();
        await window.startDragging();
        console.log('[DRAG] Drag started successfully');
      } catch (error) {
        console.error('[DRAG] Failed to start dragging:', error);
      }
    } else {
      console.log('[DRAG] Clicked interactive element, not dragging');
    }
  };

  return (
    <>
      <MinimizeOrb isMinimized={isMinimized} onRestore={handleRestore} />
      {!isMinimized && (
        <div
          className="w-screen h-screen flex overflow-hidden justify-center items-start cursor-move"
          onMouseDown={handleMouseDown}
        >
          <Card className="w-full flex flex-col p-0">
            {/* Main Toolbar */}
            <div className="flex flex-row items-center gap-2 p-2">
              <Completion />
              <ChatHistory
                onSelectConversation={handleSelectConversation}
                onNewConversation={handleNewConversation}
                currentConversationId={null}
                onViewAllChats={handleViewAllChats}
              />
              <Settings onOpenIntegrations={handleOpenIntegrations} />
            </div>
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
      )}
    </>
  );
};

export default App;
