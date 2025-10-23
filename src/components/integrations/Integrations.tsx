import React, { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import { Popover, PopoverContent, PopoverAnchor, Button, ScrollArea, SpotlightArea } from "@/components";
import { getAvailableIntegrations, Integration } from "./integrationDefinitions";
import { useWindowResize, useWindowFocus } from "@/hooks";

interface IntegrationsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Integrations: React.FC<IntegrationsProps> = ({
  isOpen,
  onClose,
}) => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const { resizeWindow } = useWindowResize();

  // Initialize integrations
  useEffect(() => {
    if (isOpen) {
      initializeIntegrations();
    }
  }, [isOpen]);

  // Match ChatHistory: resize window when popover open state changes
  useEffect(() => {
    resizeWindow(isOpen);
  }, [isOpen, resizeWindow]);

  // Close when window focus is lost (like ChatHistory)
  useWindowFocus({
    onFocusLost: () => {
      onClose();
    },
  });

  const updateIntegration = (integrationId: string, updates: Partial<Integration>) => {
    setIntegrations(prev => prev.map(integration =>
      integration.id === integrationId
        ? { ...integration, ...updates }
        : integration
    ));
  };

  const initializeIntegrations = async () => {
    const availableIntegrations = await getAvailableIntegrations();
    setIntegrations(availableIntegrations);
  };

  const handleConnect = async (integrationId: string) => {
    const integration = integrations.find(i => i.id === integrationId);
    if (integration) {
      if (!integration.isAvailable) {
        updateIntegration(integrationId, { connectMessage: integration.connectMessage || "Coming soon" });
        return;
      }
      updateIntegration(integrationId, { isConnecting: true, connectMessage: null });

      try {
        await integration.connect();
        updateIntegration(integrationId, {
          isConnecting: false,
          connectMessage: "Connected successfully",
          isConnected: true
        });
      } catch (e: any) {
        updateIntegration(integrationId, {
          isConnecting: false,
          connectMessage: e?.toString?.() || "Failed to connect",
          isConnected: false
        });
      }
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    const integration = integrations.find(i => i.id === integrationId);
    if (integration) {
      updateIntegration(integrationId, { isConnecting: true });

      try {
        await integration.disconnect();
        updateIntegration(integrationId, {
          isConnecting: false,
          connectMessage: "Disconnected successfully",
          isConnected: false
        });
      } catch (e: any) {
        updateIntegration(integrationId, {
          isConnecting: false,
          connectMessage: e?.toString?.() || "Failed to disconnect",
          isConnected: false
        });
      }
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {/* Anchor near top-right like ChatHistory button */}
      <PopoverAnchor asChild>
        <div className="fixed top-2 right-2 w-0 h-0" />
      </PopoverAnchor>
      <PopoverContent
        align="end"
        side="bottom"
        className="select-none w-screen p-0 border overflow-hidden border-input/50"
        sideOffset={8}
      >
        <div className="border-b border-input/50 p-4">
          <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
            Integrations
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Connect and manage your third-party integrations
          </p>
        </div>
        <ScrollArea className="h-[calc(100vh-8.75rem)]">
          <div className="p-6 space-y-4">

            {integrations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Settings className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-lg text-muted-foreground">
                  No integrations available
                </p>
                <p className="text-sm text-muted-foreground/70 mt-2">
                  Integrations will appear here when available
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Communication */}
                <Section
                  title="Communication"
                  subtitle="Email and messaging tools to stay in sync"
                  items={integrations.filter((i) => ["slack", "outlook", "gmail"].includes(i.id))}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                />
                {/* Productivity */}
                <Section
                  title="Productivity"
                  subtitle="Docs, calendars, notes and more"
                  items={integrations.filter((i) => [
                    "google-suite",
                    "google-calendar",
                    "google-docs",
                    "google-slides",
                    "google-sheets",
                    "notion",
                  ].includes(i.id))}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                />
                {/* Dev */}
                <Section
                  title="Dev"
                  subtitle="Developer tools and issue tracking"
                  items={integrations.filter((i) => ["github", "linear"].includes(i.id))}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                />
                {/* Other */}
                <Section
                  title="Other"
                  subtitle="Additional integrations to extend your workflow"
                  items={integrations.filter((i) => ["loops"].includes(i.id))}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                />
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

// Section component for grouped rendering
const Section: React.FC<{
  title: string;
  subtitle?: string;
  items: Integration[];
  onConnect: (integrationId: string) => void | Promise<void>;
  onDisconnect: (integrationId: string) => void | Promise<void>;
}> = ({ title, subtitle, items, onConnect, onDisconnect }) => {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="mb-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {items.map((integration) => (
          <SpotlightArea
            as="div"
            key={integration.id}
            className="flex items-start justify-between gap-3 p-3 rounded-md border border-input/50 bg-background/50"
          >
            <div className="text-sm flex items-start gap-3">
              <div className="mt-0.5 text-muted-foreground">{integration.icon}</div>
              <div>
                <div className="font-medium flex items-center gap-2">
                  {integration.name}
                  {!integration.isAvailable && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Coming soon</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{integration.description}</div>
                {integration.connectMessage && (
                  <div className="text-xs text-muted-foreground mt-1" title={integration.connectMessage}>{integration.connectMessage}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {integration.isConnected ? (
                <Button onClick={() => onDisconnect(integration.id)} disabled={integration.isConnecting} size="sm" variant="secondary">
                  {integration.isConnecting ? "Disconnecting..." : "Disconnect"}
                </Button>
              ) : (
                <Button onClick={() => onConnect(integration.id)} disabled={integration.isConnecting || !integration.isAvailable} size="sm">
                  {integration.isConnecting ? "Connecting..." : "Connect"}
                </Button>
              )}
            </div>
          </SpotlightArea>
        ))}
      </div>
    </div>
  );
};