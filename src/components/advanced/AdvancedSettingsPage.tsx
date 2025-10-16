import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, ScrollArea, SpotlightArea, Input, Textarea, Label } from "@/components";
// Theme changes (light/dark/system) are handled here directly for the website
import { useTheme } from "@/theme-provider";
import { getAvailableIntegrations, Integration } from "@/components/integrations/integrationDefinitions";
import { loadChatHistory, clearChatHistory, loadSettingsFromStorage, saveSettingsToStorage } from "@/lib/storage";
import { createPersona, updatePersona, deletePersona } from "@/lib/personas";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Settings, Trash2, Plus, Edit2, Check, X, Star } from "lucide-react";
import { STORAGE_KEYS } from "@/config";
import { Persona, SettingsState } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

type SectionKey =
  | "profile"
  | "angel-profiles"
  | "notifications"
  | "actions"
  | "design"
  | "integrations"
  | "payments"
  | "manage-data";

const sections: { key: SectionKey; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "angel-profiles", label: "Angel Profiles" },
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
            <h1 className="text-2xl font-bold tracking-tight aa-gradient-text">
              advanced settings
            </h1>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6">
            {active === "profile" && <ProfileSection />}
            {active === "angel-profiles" && <AngelProfilesSection />}
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
const AngelProfilesSection: React.FC = () => {
  const { user, isAuthenticated, updateUserProfile, isLoading } = useAuth();
  const [settings, setSettings] = useState<SettingsState>(loadSettingsFromStorage);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingPrompt, setEditingPrompt] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const updateSettings = (updates: Partial<SettingsState>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    saveSettingsToStorage(newSettings);
  };

  const handleActivatePersona = (personaId: string) => {
    updateSettings({ currentPersonaId: personaId });
  };

  const handleSaveCurrentPersonaToProfile = async () => {
    if (!isAuthenticated || !user || !settings.currentPersonaId) return;
    setSaveSuccess(false);
    try {
      await updateUserProfile({
        current_persona_id: settings.currentPersonaId,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save persona preference:', error);
    }
  };

  const handleStartEdit = (persona: Persona) => {
    setEditingId(persona.id);
    setEditingName(persona.name);
    setEditingPrompt(persona.prompt);
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    
    const updatedPersonas = settings.personas.map(p => 
      p.id === editingId ? updatePersona(p, { name: editingName, prompt: editingPrompt }) : p
    );
    
    updateSettings({ personas: updatedPersonas });
    setEditingId(null);
    setEditingName("");
    setEditingPrompt("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingPrompt("");
  };

  const handleDeletePersona = (personaId: string) => {
    if (settings.personas.find(p => p.id === personaId)?.isDefault) {
      return; // Don't delete default personas
    }
    
    const updatedPersonas = deletePersona(settings.personas, personaId);
    let newCurrentId = settings.currentPersonaId;
    
    // If we're deleting the current persona, switch to the first available one
    if (settings.currentPersonaId === personaId) {
      newCurrentId = updatedPersonas[0]?.id || "assistant";
    }
    
    updateSettings({ 
      personas: updatedPersonas,
      currentPersonaId: newCurrentId
    });
  };

  const handleStartCreate = () => {
    setIsCreating(true);
    setNewName("");
    setNewPrompt("");
  };

  const handleSaveCreate = () => {
    if (!newName.trim() || !newPrompt.trim()) return;
    
    const newPersona = createPersona(newName, newPrompt);
    const updatedPersonas = [...settings.personas, newPersona];
    
    updateSettings({ personas: updatedPersonas });
    setIsCreating(false);
    setNewName("");
    setNewPrompt("");
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewName("");
    setNewPrompt("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Angel Profiles</h2>
          <p className="text-sm text-muted-foreground">
            Manage different AI personas with unique behaviors and specialties.
          </p>
        </div>
        <div className="flex gap-2">
          {isAuthenticated && (
            <Button
              onClick={handleSaveCurrentPersonaToProfile}
              size="sm"
              variant={saveSuccess ? "default" : "outline"}
              disabled={isLoading}
              className={cn(saveSuccess && "bg-green-600 hover:bg-green-700")}
            >
              {saveSuccess ? <Check className="w-4 h-4 mr-1" /> : null}
              {saveSuccess ? "Saved!" : "Save Active to Profile"}
            </Button>
          )}
          <Button onClick={handleStartCreate} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Create Persona
          </Button>
        </div>
      </div>

      {/* Create new persona form */}
      {isCreating && (
        <SpotlightArea className="p-4 border border-input/50 rounded-md bg-background/50">
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium">Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Creative Writer"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Prompt</Label>
              <Textarea
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                placeholder="Describe the persona's role, expertise, and behavior..."
                className="mt-1 min-h-[80px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleSaveCreate} size="sm" disabled={!newName.trim() || !newPrompt.trim()}>
                <Check className="w-4 h-4 mr-1" />
                Create
              </Button>
              <Button onClick={handleCancelCreate} size="sm" variant="secondary">
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        </SpotlightArea>
      )}

      {/* Existing personas */}
      <div className="grid grid-cols-1 gap-3">
        {settings.personas.map((persona) => (
          <SpotlightArea 
            key={persona.id}
            className={cn(
              "p-4 border rounded-md bg-background/50 transition-colors",
              settings.currentPersonaId === persona.id 
                ? "border-primary bg-primary/5" 
                : "border-input/50"
            )}
          >
            {editingId === persona.id ? (
              // Edit mode
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Name</Label>
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Prompt</Label>
                  <Textarea
                    value={editingPrompt}
                    onChange={(e) => setEditingPrompt(e.target.value)}
                    className="mt-1 min-h-[80px]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={handleSaveEdit} size="sm">
                    <Check className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                  <Button onClick={handleCancelEdit} size="sm" variant="secondary">
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              // View mode
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-sm flex items-center gap-2">
                      {persona.name}
                      {persona.isDefault && <Star className="w-3 h-3 text-amber-500" />}
                      {settings.currentPersonaId === persona.id && (
                        <span className="text-xs px-2 py-0.5 rounded bg-primary text-primary-foreground">
                          Active
                        </span>
                      )}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {persona.summary}
                  </p>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      View prompt
                    </summary>
                    <div className="mt-2 p-2 bg-muted/50 rounded text-muted-foreground whitespace-pre-wrap text-xs">
                      {persona.prompt}
                    </div>
                  </details>
                </div>
                <div className="flex items-center gap-1">
                  {settings.currentPersonaId !== persona.id && (
                    <Button
                      onClick={() => handleActivatePersona(persona.id)}
                      size="sm"
                      variant="secondary"
                    >
                      Activate
                    </Button>
                  )}
                  <Button
                    onClick={() => handleStartEdit(persona)}
                    size="sm"
                    variant="ghost"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  {!persona.isDefault && (
                    <Button
                      onClick={() => handleDeletePersona(persona.id)}
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </SpotlightArea>
        ))}
      </div>
    </div>
  );
};

const ProfileSection: React.FC = () => {
  const { user, isAuthenticated, updateUserProfile, isLoading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    if (user?.full_name) {
      setEditName(user.full_name);
    }
  }, [user]);

  const handleSave = async () => {
    if (!editName.trim()) return;
    try {
      await updateUserProfile({ full_name: editName.trim() });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleCancel = () => {
    setEditName(user?.full_name || "");
    setIsEditing(false);
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground">Your personal information and account details.</p>
        <SpotlightArea className="p-4 border border-input/50 rounded-md bg-background/50">
          <div className="text-sm text-muted-foreground">Please sign in to view your profile.</div>
        </SpotlightArea>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Profile</h2>
      <p className="text-sm text-muted-foreground">Your personal information and account details.</p>

      {/* Personal Information */}
      <SpotlightArea className="p-4 border border-input/50 rounded-md bg-background/50">
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm">Personal Information</h3>
            {!isEditing && (
              <Button onClick={() => setIsEditing(true)} size="sm" variant="secondary">
                <Edit2 className="w-3 h-3 mr-1" />
                Edit
              </Button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Full Name</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter your full name"
                  className="mt-1"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleSave} size="sm" disabled={isLoading || !editName.trim()}>
                  <Check className="w-4 h-4 mr-1" />
                  Save
                </Button>
                <Button onClick={handleCancel} size="sm" variant="secondary">
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Full Name</Label>
                <p className="text-sm">{user.full_name || "Not set"}</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Email</Label>
                <p className="text-sm">{user.email}</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Account Created</Label>
                <p className="text-sm">{new Date(user.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          )}
        </div>
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
  const { theme, setTheme } = useTheme();
  const { user, isAuthenticated, updateUserProfile, isLoading } = useAuth();
  const [accent, setAccent] = useState<string>(() => localStorage.getItem(STORAGE_KEYS.DESIGN_ACCENT) || "bw");
  const [gradient, setGradient] = useState<string>(() => localStorage.getItem(STORAGE_KEYS.DESIGN_GRADIENT) || "bw");
  const channelRef = React.useRef<BroadcastChannel | null>(null);
  const postTimerRef = useRef<number | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const postDesignUpdate = (a: string, g: string, t: string) => {
    const payload = { accent: a, gradient: g, theme: t } as any;
    // Attempt both localhost and 127.0.0.1 to maximize success
    const send = (base: string) => fetch(`${base}/design`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      mode: "cors",
      keepalive: true,
    }).catch(() => {});
    send("http://127.0.0.1:8765");
    send("http://localhost:8765");
  };

  // Debounced notifier to avoid bursts
  const postDesignUpdateDebounced = (a: string, g: string, t: string) => {
    if (postTimerRef.current) window.clearTimeout(postTimerRef.current);
    postTimerRef.current = window.setTimeout(() => {
      postDesignUpdate(a, g, t);
      postTimerRef.current = null;
    }, 100) as unknown as number;
  };

  useEffect(() => {
    try {
      channelRef.current = new BroadcastChannel("arkangel-design");
    } catch {}
    return () => {
      try { channelRef.current?.close(); } catch {}
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.accent = accent; // 'bw' | 'rainbow'
    localStorage.setItem(STORAGE_KEYS.DESIGN_ACCENT, accent);
    try { channelRef.current?.postMessage({ type: "accent", value: accent }); } catch {}
  }, [accent]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.gradient = gradient; // 'bw' | 'rainbow'
    localStorage.setItem(STORAGE_KEYS.DESIGN_GRADIENT, gradient);
    try { channelRef.current?.postMessage({ type: "gradient", value: gradient }); } catch {}
  }, [gradient]);

  useEffect(() => {
    // Broadcast theme changes to main app
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    try { channelRef.current?.postMessage({ type: "theme", value: theme }); } catch {}
  }, [theme]);

  // Single centralized notifier to sidecar (avoid duplicate POSTs)
  useEffect(() => {
    postDesignUpdateDebounced(accent, gradient, theme);
  }, [accent, gradient, theme]);

  const handleSaveToProfile = async () => {
    if (!isAuthenticated || !user) return;
    setSaveSuccess(false);
    try {
      await updateUserProfile({
        design_accent: accent,
        design_gradient: gradient,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save design preferences:', error);
    }
  };

  // Connection indicator: ping sidecar periodically
  useEffect(() => {
    let mounted = true;
    let id: number | null = null;
    const ping = async () => {
      const tryPing = async (base: string) => {
        try {
          const r = await fetch(`${base}/design/ping`, { method: 'GET', mode: 'cors' });
          if (!mounted) return false;
          if (r.ok) {
            setConnected(true);
            return true;
          }
        } catch {}
        return false;
      };
      const ok = await tryPing('http://127.0.0.1:8765') || await tryPing('http://localhost:8765');
      if (!ok && mounted) setConnected(false);
    };
    void ping();
    id = window.setInterval(ping, 5000) as unknown as number;
    return () => { mounted = false; if (id) window.clearInterval(id); };
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Design</h2>
      <p className="text-sm text-muted-foreground">Choose minimalist black/white or expressive rainbow accents. Gradients can also be rainbow.</p>

      {/* Option A: Single control for Accent Style (sets both accent and gradient) */}
      <SpotlightArea className="p-4 border border-input/50 rounded-md bg-background/50">
        <div className="mb-2 text-sm font-medium">Accent Style</div>
        <div className="text-xs text-muted-foreground mb-3">Choose neutral b/w or expressive rainbow for accents and spotlight effects.</div>
        <fieldset className="flex items-center gap-3" aria-label="Accent Style">
          <label className="inline-flex items-center justify-center">
            <input
              type="radio"
              name="accent-style"
              value="bw"
              className="sr-only"
              checked={accent === "bw" && gradient === "bw"}
              onChange={() => { setAccent("bw"); setGradient("bw"); }}
            />
            <span
              className={cn(
                "h-10 w-10 rounded-full border border-input/50 bg-gradient-to-br from-background to-foreground/10",
                accent === "bw" && gradient === "bw" && "ring-2 ring-primary"
              )}
              aria-hidden="true"
              title="Black & White"
            />
            <span className="sr-only">Black &amp; White</span>
          </label>
          <label className="inline-flex items-center justify-center">
            <input
              type="radio"
              name="accent-style"
              value="rainbow"
              className="sr-only"
              checked={accent === "rainbow" && gradient === "rainbow"}
              onChange={() => { setAccent("rainbow"); setGradient("rainbow"); }}
            />
            <span
              className={cn(
                "h-10 w-10 rounded-full border border-input/50",
                "bg-[conic-gradient(#ef4444,#f59e0b,#22c55e,#3b82f6,#6366f1,#a855f7,#ef4444)]",
                accent === "rainbow" && gradient === "rainbow" && "ring-2 ring-primary"
              )}
              aria-hidden="true"
              title="Rainbow"
            />
            <span className="sr-only">Rainbow</span>
          </label>
        </fieldset>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn("inline-block h-2 w-2 rounded-full", connected ? "bg-green-500" : "bg-zinc-500")}></span>
            {connected ? "Connected to app" : "Not connected"}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => { setTheme("system"); setAccent("bw"); setGradient("bw"); }}>
              Reset to defaults
            </Button>
            {isAuthenticated && (
              <Button
                size="sm"
                variant={saveSuccess ? "default" : "outline"}
                onClick={handleSaveToProfile}
                disabled={isLoading}
                className={cn(saveSuccess && "bg-green-600 hover:bg-green-700")}
              >
                {saveSuccess ? <Check className="w-4 h-4 mr-1" /> : null}
                {saveSuccess ? "Saved!" : "Save to Profile"}
              </Button>
            )}
          </div>
        </div>
      </SpotlightArea>

      {/* Theme Appearance (light / dark / system) - website only */}
      <SpotlightArea className="p-4 border border-input/50 rounded-md bg-background/50">
        <div className="mb-2 text-sm font-medium">Appearance</div>
        <div className="text-xs text-muted-foreground mb-3">Choose when the app uses light or dark mode.</div>
        <div className="flex items-center gap-2">
          <button
            className={cn(
              "px-3 py-1.5 rounded-md border border-input/50 text-sm",
              theme === "light" && "ring-2 ring-primary"
            )}
            onClick={() => setTheme("light")}
          >
            light
          </button>
          <button
            className={cn(
              "px-3 py-1.5 rounded-md border border-input/50 text-sm",
              theme === "dark" && "ring-2 ring-primary"
            )}
            onClick={() => setTheme("dark")}
          >
            dark
          </button>
          <button
            className={cn(
              "px-3 py-1.5 rounded-md border border-input/50 text-sm",
              theme === "system" && "ring-2 ring-primary"
            )}
            onClick={() => setTheme("system")}
          >
            system
          </button>
        </div>
      </SpotlightArea>
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
