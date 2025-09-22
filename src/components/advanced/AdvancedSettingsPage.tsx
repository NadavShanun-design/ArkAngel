import React, { useEffect, useMemo, useState } from "react";
import { Button, ScrollArea, SpotlightArea } from "@/components";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { getAvailableIntegrations, Integration } from "@/components/integrations/integrationDefinitions";
import { loadChatHistory, clearChatHistory } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Settings, Trash2 } from "lucide-react";

type SectionKey =
  | "profile"
  | "notifications"
  | "actions"
  | "design"
  | "integrations"
  | "payments"
  | "manage-data";

const sections: { key: SectionKey; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "notifications", label: "Notifications" },
  { key: "actions", label: "Actions" },
  { key: "design", label: "Design" },
  { key: "integrations", label: "Integrations" },
  { key: "payments", label: "Payments" },
  { key: "manage-data", label: "Manage Data" },
];

export const AdvancedSettingsPage: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [active, setActive] = useState<SectionKey>("profile");

  // Keep internal state only; external routing handled in main.tsx (/settings)

  return (
    <div className="w-screen h-screen overflow-hidden grid" style={{ gridTemplateColumns: sidebarOpen ? "240px 1fr" : "56px 1fr" }}>
      {/* Sidebar */}
      <aside className="border-r border-input/50 h-full bg-background/60 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2 p-2 border-b border-input/50">
          <Button size="icon" variant="ghost" aria-label={sidebarOpen ? "Collapse" : "Expand"} onClick={() => setSidebarOpen((s) => !s)}>
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          {sidebarOpen && (
            <div className="text-xs text-muted-foreground pr-1">Advanced</div>
          )}
        </div>
        <nav className="py-2">
          {sections.map((s) => (
            <button
              key={s.key}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-accent/40 transition-colors",
                active === s.key ? "bg-accent/50" : ""
              )}
              onClick={() => setActive(s.key)}
            >
              {sidebarOpen ? s.label : s.label[0]}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b border-input/50 p-6">
          <div className="w-full flex flex-col items-center text-center">
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              advanced settings
            </h1>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6">
            {active === "profile" && <ProfileSection />}
            {active === "notifications" && <NotificationsSection />}
            {active === "actions" && <ActionsSection />}
            {active === "design" && <DesignSection />}
            {active === "integrations" && <IntegrationsSection />}
            {active === "payments" && <PaymentsSection />}
            {active === "manage-data" && <ManageDataSection />}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
};

// Sections
const ProfileSection: React.FC = () => {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Profile</h2>
      <p className="text-sm text-muted-foreground">Basic account preferences. This page is a companion to keep the main app focused.</p>
      <SpotlightArea className="p-4 border border-input/50 rounded-md bg-background/50">
        <div className="text-sm text-muted-foreground">User profile details will live here. Coming soon.</div>
      </SpotlightArea>
    </div>
  );
};

const NotificationsSection: React.FC = () => {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Notifications</h2>
      <p className="text-sm text-muted-foreground">Tune how ArkAngel keeps you informed.</p>
      <SpotlightArea className="p-4 border border-input/50 rounded-md bg-background/50">
        <ul className="text-sm list-disc list-inside text-muted-foreground space-y-1">
          <li>Sound alerts for message responses</li>
          <li>Desktop notifications for long tasks</li>
          <li>Daily recap emails (future)</li>
        </ul>
      </SpotlightArea>
    </div>
  );
};

const ActionsSection: React.FC = () => {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Actions</h2>
      <p className="text-sm text-muted-foreground">Shortcuts and automations that complement in-app features.</p>
      <SpotlightArea className="p-4 border border-input/50 rounded-md bg-background/50">
        <ul className="text-sm list-disc list-inside text-muted-foreground space-y-1">
          <li>New conversation shortcut</li>
          <li>Quick summarize selection</li>
          <li>Clipboard parsing</li>
        </ul>
      </SpotlightArea>
    </div>
  );
};

const DesignSection: React.FC = () => {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Design</h2>
      <p className="text-sm text-muted-foreground">Theme and appearance that mirror the main application.</p>
      <div className="p-4 border border-input/50 rounded-md bg-background/50">
        <ThemeToggle />
      </div>
    </div>
  );
};

const IntegrationsSection: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const list = await getAvailableIntegrations();
      setIntegrations(list);
      setLoading(false);
    };
    init();
  }, []);

  const update = (id: string, updates: Partial<Integration>) => {
    setIntegrations((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
  };

  const handleConnect = async (id: string) => {
    const i = integrations.find((x) => x.id === id);
    if (!i) return;
    if (!i.isAvailable) {
      update(id, { connectMessage: i.connectMessage || "Coming soon" });
      return;
    }
    update(id, { isConnecting: true, connectMessage: null });
    try {
      await i.connect();
      update(id, { isConnecting: false, isConnected: true, connectMessage: "Connected successfully" });
    } catch (e: any) {
      update(id, { isConnecting: false, isConnected: false, connectMessage: e?.toString?.() || "Failed to connect" });
    }
  };

  const handleDisconnect = async (id: string) => {
    const i = integrations.find((x) => x.id === id);
    if (!i) return;
    update(id, { isConnecting: true });
    try {
      await i.disconnect();
      update(id, { isConnecting: false, isConnected: false, connectMessage: "Disconnected successfully" });
    } catch (e: any) {
      update(id, { isConnecting: false, isConnected: false, connectMessage: e?.toString?.() || "Failed to disconnect" });
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Integrations</h2>
      <p className="text-sm text-muted-foreground">Manage third-party connections outside the main UI.</p>
      {(() => {
        if (loading) {
          return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Settings className="w-4 h-4"/> Loading…</div>
          );
        }
        if (integrations.length === 0) {
          return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Settings className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <p className="text-lg text-muted-foreground">No integrations available</p>
            </div>
          );
        }
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {integrations.map((integration) => (
              <SpotlightArea key={integration.id} className="flex items-start justify-between gap-3 p-3 rounded-md border border-input/50 bg-background/50">
                <div className="text-sm">
                  <div className="font-medium flex items-center gap-2">
                    <span className="text-muted-foreground">{integration.icon}</span>
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
                <div className="flex items-center gap-2">
                  {integration.isConnected ? (
                    <Button onClick={() => handleDisconnect(integration.id)} disabled={integration.isConnecting} size="sm" variant="secondary">
                      {integration.isConnecting ? "Disconnecting…" : "Disconnect"}
                    </Button>
                  ) : (
                    <Button onClick={() => handleConnect(integration.id)} disabled={integration.isConnecting || !integration.isAvailable} size="sm">
                      {integration.isConnecting ? "Connecting…" : "Connect"}
                    </Button>
                  )}
                </div>
              </SpotlightArea>
            ))}
          </div>
        );
      })()}
    </div>
  );
};

const PaymentsSection: React.FC = () => {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Payments</h2>
      <p className="text-sm text-muted-foreground">Billing and subscriptions. Coming soon.</p>
      <SpotlightArea className="p-4 border border-input/50 rounded-md bg-background/50">
        <div className="text-sm text-muted-foreground">You’ll be able to manage plans and invoices here.</div>
      </SpotlightArea>
    </div>
  );
};

const ManageDataSection: React.FC = () => {
  const conversations = useMemo(() => loadChatHistory(), []);
  const [count, setCount] = useState(conversations.length);

  const handleClear = () => {
    clearChatHistory();
    setCount(0);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Manage Data</h2>
      <p className="text-sm text-muted-foreground">Review and maintain your local chat data.</p>
      <SpotlightArea className="p-4 border border-input/50 rounded-md bg-background/50 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Conversations stored locally: <span className="font-medium text-foreground">{count}</span></div>
        <Button size="sm" variant="destructive" onClick={handleClear}>
          <Trash2 className="w-4 h-4 mr-1"/> Clear chat history
        </Button>
      </SpotlightArea>
    </div>
  );
};

export default AdvancedSettingsPage;
