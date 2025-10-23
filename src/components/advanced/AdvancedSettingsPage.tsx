import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, ScrollArea, SpotlightArea, Input, Textarea, Label } from "@/components";
// Theme changes (light/dark/system) are handled here directly for the website
import { useTheme } from "@/theme-provider";
import { getAvailableIntegrations, Integration } from "@/components/integrations/integrationDefinitions";
import { loadChatHistory, clearChatHistory, loadSettingsFromStorage, saveSettingsToStorage } from "@/lib/storage";
import { createPersona, updatePersona, deletePersona } from "@/lib/personas";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Settings, Trash2, Plus, Edit2, Check, X, Star, FileText, FileCode, FileImage, FileVideo, FileAudio, File, Eye, Square, CheckSquare } from "lucide-react";
import { STORAGE_KEYS } from "@/config";
import { Persona, SettingsState } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { createCheckoutSession, createPortalSession, STRIPE_PRICES, type SubscriptionTier } from "@/lib/stripe";
import { TranscriptViewer } from "@/components/transcripts";
import { CreatePersonaWizard } from "@/components/training";
import ReactMarkdown from "react-markdown";

type SectionKey =
  | "profile"
  | "angel-profiles"
  | "notifications"
  | "actions"
  | "design"
  | "agent"
  | "integrations"
  | "payments"
  | "documents"
  | "transcripts"
  | "training"
  | "manage-data";

const sections: { key: SectionKey; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "angel-profiles", label: "Angel Profiles" },
  { key: "notifications", label: "Notifications" },
  { key: "actions", label: "Actions" },
  { key: "design", label: "Design" },
  { key: "agent", label: "Agent" },
  { key: "integrations", label: "Integrations" },
  { key: "payments", label: "Payments" },
  { key: "documents", label: "Documents" },
  { key: "transcripts", label: "Transcripts" },
  { key: "training", label: "Training" },
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
      <main className="h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-input/50 p-6 flex-shrink-0">
          <div className="w-full flex flex-col items-center text-center">
            <h1 className="text-2xl font-bold tracking-tight aa-gradient-text">
              advanced settings
            </h1>
          </div>
        </div>

        <ScrollArea className="flex-1 overflow-hidden">
          <div className="p-6 pb-24">
            {active === "profile" && <ProfileSection />}
            {active === "angel-profiles" && <AngelProfilesSection />}
            {active === "notifications" && <NotificationsSection />}
            {active === "actions" && <ActionsSection />}
            {active === "design" && <DesignSection />}
            {active === "agent" && <AgentSection />}
            {active === "integrations" && <IntegrationsSection />}
            {active === "payments" && <PaymentsSection />}
            {active === "documents" && <DocumentsSection />}
            {active === "transcripts" && <TranscriptsSection />}
            {active === "training" && <TrainingSection />}
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
  const [editingRagEnabled, setEditingRagEnabled] = useState(false);
  const [editingRagSystemId, setEditingRagSystemId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [newRagEnabled, setNewRagEnabled] = useState(false);
  const [newRagSystemId, setNewRagSystemId] = useState("");
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [ragPersonas, setRagPersonas] = useState<RagPersona[]>([]);

  // Load RAG personas on mount
  useEffect(() => {
    const loadRagPersonas = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const personas = await invoke<RagPersona[]>('list_rag_personas');
        setRagPersonas(personas);
      } catch (error) {
        console.error('Failed to load RAG personas:', error);
      }
    };
    loadRagPersonas();
  }, []);

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
    setEditingRagEnabled(persona.ragEnabled || false);
    setEditingRagSystemId(persona.ragSystemId || "");
  };

  const handleSaveEdit = () => {
    if (!editingId) return;

    const updatedPersonas = settings.personas.map(p =>
      p.id === editingId ? updatePersona(p, {
        name: editingName,
        prompt: editingPrompt,
        ragEnabled: editingRagEnabled,
        ragSystemId: editingRagEnabled ? editingRagSystemId : undefined,
        ragQueryTopK: 5,
      }) : p
    );

    updateSettings({ personas: updatedPersonas });
    setEditingId(null);
    setEditingName("");
    setEditingPrompt("");
    setEditingRagEnabled(false);
    setEditingRagSystemId("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingPrompt("");
    setEditingRagEnabled(false);
    setEditingRagSystemId("");
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

    const newPersona = {
      ...createPersona(newName, newPrompt),
      ragEnabled: newRagEnabled,
      ragSystemId: newRagEnabled ? newRagSystemId : undefined,
      ragQueryTopK: 5,
    };
    const updatedPersonas = [...settings.personas, newPersona];

    updateSettings({ personas: updatedPersonas });
    setIsCreating(false);
    setNewName("");
    setNewPrompt("");
    setNewRagEnabled(false);
    setNewRagSystemId("");
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewName("");
    setNewPrompt("");
    setNewRagEnabled(false);
    setNewRagSystemId("");
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

            {/* RAG Selection */}
            <div className="space-y-2 pt-2 border-t border-input/30">
              <Label className="text-sm font-medium flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newRagEnabled}
                  onChange={(e) => setNewRagEnabled(e.target.checked)}
                  className="w-4 h-4"
                />
                Enable RAG (Retrieval-Augmented Generation)
              </Label>
              {newRagEnabled && ragPersonas.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Select RAG System</Label>
                  <select
                    value={newRagSystemId}
                    onChange={(e) => setNewRagSystemId(e.target.value)}
                    className="mt-1 w-full p-2 text-sm border border-input rounded-md bg-background"
                  >
                    <option value="">Select a RAG system...</option>
                    {ragPersonas.map((rp) => (
                      <option key={rp.id} value={rp.id}>
                        {rp.name} ({rp.source_count} sources, {rp.chunk_count} chunks)
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {newRagEnabled && ragPersonas.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No RAG systems available. Create one in the Training section first.
                </p>
              )}
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

                {/* RAG Selection */}
                <div className="space-y-2 pt-2 border-t border-input/30">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editingRagEnabled}
                      onChange={(e) => setEditingRagEnabled(e.target.checked)}
                      className="w-4 h-4"
                    />
                    Enable RAG (Retrieval-Augmented Generation)
                  </Label>
                  {editingRagEnabled && ragPersonas.length > 0 && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Select RAG System</Label>
                      <select
                        value={editingRagSystemId}
                        onChange={(e) => setEditingRagSystemId(e.target.value)}
                        className="mt-1 w-full p-2 text-sm border border-input rounded-md bg-background"
                      >
                        <option value="">Select a RAG system...</option>
                        {ragPersonas.map((rp) => (
                          <option key={rp.id} value={rp.id}>
                            {rp.name} ({rp.source_count} sources, {rp.chunk_count} chunks)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {editingRagEnabled && ragPersonas.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No RAG systems available. Create one in the Training section first.
                    </p>
                  )}
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
  const [editData, setEditData] = useState({
    full_name: "",
    phone: "",
    bio: "",
    location: "",
    website: "",
    avatar_url: ""
  });
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setEditData({
        full_name: user.full_name || "",
        phone: user.phone || "",
        bio: user.bio || "",
        location: user.location || "",
        website: user.website || "",
        avatar_url: user.avatar_url || ""
      });
    }
  }, [user]);

  const handleSave = async () => {
    if (!editData.full_name.trim()) return;
    try {
      setSaveSuccess(false);
      await updateUserProfile({
        full_name: editData.full_name.trim(),
        phone: editData.phone.trim() || undefined,
        bio: editData.bio.trim() || undefined,
        location: editData.location.trim() || undefined,
        website: editData.website.trim() || undefined,
        avatar_url: editData.avatar_url.trim() || undefined
      });
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleCancel = () => {
    if (user) {
      setEditData({
        full_name: user.full_name || "",
        phone: user.phone || "",
        bio: user.bio || "",
        location: user.location || "",
        website: user.website || "",
        avatar_url: user.avatar_url || ""
      });
    }
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

  const getInitials = () => {
    if (user.full_name) {
      return user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return user.email[0].toUpperCase();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Profile</h2>
          <p className="text-sm text-muted-foreground">Your personal information and account details.</p>
        </div>
        {saveSuccess && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check className="w-4 h-4" />
            Saved to profile!
          </div>
        )}
      </div>

      {/* Profile Header with Avatar */}
      <SpotlightArea className="p-4 border border-input/50 rounded-md bg-background/50">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            {editData.avatar_url ? (
              <img
                src={editData.avatar_url}
                alt={user.full_name || 'Profile'}
                className="w-20 h-20 rounded-full object-cover border-2 border-primary"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center text-2xl font-semibold",
              "bg-gradient-to-br from-primary/20 to-primary/5 text-primary",
              editData.avatar_url && "hidden"
            )}>
              {getInitials()}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold truncate">{user.full_name || 'User'}</h3>
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            {user.location && (
              <p className="text-xs text-muted-foreground mt-1">{user.location}</p>
            )}
            {user.bio && (
              <p className="text-sm mt-2">{user.bio}</p>
            )}
          </div>
        </div>
      </SpotlightArea>

      {/* Personal Information */}
      <SpotlightArea className="p-4 border border-input/50 rounded-md bg-background/50">
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm">Personal Information</h3>
            {!isEditing && (
              <Button onClick={() => setIsEditing(true)} size="sm" variant="secondary">
                <Edit2 className="w-3 h-3 mr-1" />
                Edit Profile
              </Button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Full Name *</Label>
                  <Input
                    value={editData.full_name}
                    onChange={(e) => setEditData(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Enter your full name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Phone</Label>
                  <Input
                    value={editData.phone}
                    onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 (555) 123-4567"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Bio</Label>
                <Textarea
                  value={editData.bio}
                  onChange={(e) => setEditData(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Tell us about yourself..."
                  className="mt-1 min-h-[80px]"
                  maxLength={300}
                />
                <div className="text-xs text-muted-foreground mt-1">
                  {editData.bio.length}/300 characters
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Location</Label>
                  <Input
                    value={editData.location}
                    onChange={(e) => setEditData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="City, Country"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Website</Label>
                  <Input
                    value={editData.website}
                    onChange={(e) => setEditData(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://example.com"
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Avatar URL</Label>
                <Input
                  value={editData.avatar_url}
                  onChange={(e) => setEditData(prev => ({ ...prev, avatar_url: e.target.value }))}
                  placeholder="https://example.com/avatar.jpg"
                  className="mt-1"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Provide a direct link to your profile picture
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button onClick={handleSave} size="sm" disabled={isLoading || !editData.full_name.trim()}>
                  <Check className="w-4 h-4 mr-1" />
                  Save Changes
                </Button>
                <Button onClick={handleCancel} size="sm" variant="secondary">
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Full Name</Label>
                <p className="text-sm">{user.full_name || "Not set"}</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Email</Label>
                <p className="text-sm">{user.email}</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Phone</Label>
                <p className="text-sm">{user.phone || "Not set"}</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Location</Label>
                <p className="text-sm">{user.location || "Not set"}</p>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs font-medium text-muted-foreground">Bio</Label>
                <p className="text-sm">{user.bio || "No bio added"}</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Website</Label>
                {user.website ? (
                  <a href={user.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                    {user.website}
                  </a>
                ) : (
                  <p className="text-sm">Not set</p>
                )}
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
  const { user, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Get current subscription tier from user profile (defaults to 'free')
  const currentTier = user?.subscription_tier || 'free';

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: '/month',
      description: 'Perfect for getting started',
      features: [
        'Basic AI conversations',
        '10 messages per day',
        'Community support',
        'Single persona',
        'Basic integrations'
      ],
      buttonText: 'Current Plan',
      disabled: true,
      popular: false
    },
    {
      id: 'premium',
      name: 'Premium',
      price: '$4.99',
      period: '/month',
      description: 'For power users',
      features: [
        'Unlimited AI conversations',
        'Priority processing',
        'Email support',
        'Multiple personas',
        'All integrations',
        'Advanced features'
      ],
      buttonText: currentTier === 'premium' ? 'Current Plan' : 'Upgrade to Premium',
      disabled: currentTier === 'premium',
      popular: true
    },
    {
      id: 'max',
      name: 'Max',
      price: '$14.99',
      period: '/month',
      description: 'Ultimate experience',
      features: [
        'Everything in Premium',
        'Advanced AI models',
        'Priority support (24/7)',
        'Unlimited personas',
        'Early feature access',
        'Custom integrations',
        'Dedicated account manager'
      ],
      buttonText: currentTier === 'max' ? 'Current Plan' : 'Upgrade to Max',
      disabled: currentTier === 'max',
      popular: false
    }
  ];

  const handleSubscribe = async (planId: string) => {
    console.log('[Payment] Subscribe button clicked for plan:', planId);

    if (!isAuthenticated || !user) {
      console.error('[Payment] User not authenticated');
      alert('Please sign in to subscribe');
      return;
    }

    if (planId === 'free') {
      console.log('[Payment] Free plan selected, no action needed');
      return;
    }

    setIsLoading(true);
    console.log('[Payment] Loading state set to true');

    try {
      // Get the price ID for the selected plan
      const priceId = planId === 'premium' ? STRIPE_PRICES.premium : STRIPE_PRICES.max;
      console.log('[Payment] Price ID for', planId, ':', priceId);
      console.log('[Payment] User ID:', user.id);
      console.log('[Payment] User Email:', user.email);

      // Create Stripe checkout session
      console.log('[Payment] Calling createCheckoutSession...');
      const result = await createCheckoutSession(
        priceId,
        user.id,
        user.email,
        planId as SubscriptionTier
      );

      console.log('[Payment] Checkout session result:', result);

      if ('error' in result) {
        throw new Error(result.error);
      }

      // Redirect to Stripe Checkout
      console.log('[Payment] Redirecting to Stripe Checkout URL:', result.url);
      window.location.href = result.url;
    } catch (error) {
      console.error('[Payment] Failed to start checkout:', error);
      alert(error instanceof Error ? error.message : 'Failed to start checkout. Please try again.');
    } finally {
      setIsLoading(false);
      console.log('[Payment] Loading state set to false');
    }
  };

  const handleManageSubscription = async () => {
    if (!isAuthenticated || !user || !user.stripe_customer_id) {
      alert('No active subscription found');
      return;
    }

    setIsLoading(true);
    try {
      const result = await createPortalSession(user.stripe_customer_id);

      if ('error' in result) {
        throw new Error(result.error);
      }

      // Redirect to Stripe Customer Portal
      window.location.href = result.url;
    } catch (error) {
      console.error('Failed to open customer portal:', error);
      alert(error instanceof Error ? error.message : 'Failed to open subscription management. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Subscription Plans</h2>
        <p className="text-sm text-muted-foreground">Choose the plan that's right for you. Powered by Stripe.</p>
      </div>

      {/* Stripe Badge */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Secure payments powered by</span>
        <svg className="h-4" viewBox="0 0 60 25" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.04 1.26-.06 1.48zm-5.92-5.62c-1.03 0-2.17.73-2.17 2.58h4.25c0-1.85-1.07-2.58-2.08-2.58zM40.95 20.3c-1.44 0-2.32-.6-2.9-1.04l-.02 4.63-4.12.87V5.57h3.76l.08 1.02a4.7 4.7 0 0 1 3.23-1.29c2.9 0 5.62 2.6 5.62 7.4 0 5.23-2.7 7.6-5.65 7.6zM40 8.95c-.95 0-1.54.34-1.97.81l.02 6.12c.4.44.98.78 1.95.78 1.52 0 2.54-1.65 2.54-3.87 0-2.15-1.04-3.84-2.54-3.84zM28.24 5.57h4.13v14.44h-4.13V5.57zm0-4.7L32.37 0v3.36l-4.13.88V.88zm-4.32 9.35v9.79H19.8V5.57h3.7l.12 1.22c1-1.77 3.07-1.41 3.62-1.22v3.79c-.52-.17-2.29-.43-3.32.86zm-8.55 4.72c0 2.43 2.6 1.68 3.12 1.46v3.36c-.55.3-1.54.54-2.89.54a4.15 4.15 0 0 1-4.27-4.24l.01-13.17 4.02-.86v3.54h3.14V9.1h-3.13v5.85zm-4.91.7c0 2.97-2.31 4.66-5.73 4.66a11.2 11.2 0 0 1-4.46-.93v-3.93c1.38.75 3.1 1.31 4.46 1.31.92 0 1.53-.24 1.53-1C6.26 13.77 0 14.51 0 9.95 0 7.04 2.28 5.3 5.62 5.3c1.36 0 2.72.2 4.09.75v3.88a9.23 9.23 0 0 0-4.1-1.06c-.86 0-1.44.25-1.44.93 0 1.85 6.29.97 6.29 5.88z"/>
        </svg>
      </div>

      {/* Current subscription status for authenticated users */}
      {isAuthenticated && (
        <SpotlightArea className="p-4 border border-input/50 rounded-md bg-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Current Plan: {plans.find(p => p.id === currentTier)?.name}</div>
              <div className="text-xs text-muted-foreground">
                {currentTier === 'free' ? 'Upgrade to unlock more features' : 'Thank you for being a subscriber!'}
              </div>
            </div>
            {currentTier !== 'free' && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleManageSubscription}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Manage Subscription'}
              </Button>
            )}
          </div>
        </SpotlightArea>
      )}

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <SpotlightArea
            key={plan.id}
            className={cn(
              "relative p-6 border rounded-lg bg-background/50 flex flex-col",
              plan.popular && "border-primary shadow-lg shadow-primary/10",
              currentTier === plan.id && "ring-2 ring-primary"
            )}
          >
            {/* Popular badge */}
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full">
                  Most Popular
                </span>
              </div>
            )}

            {/* Current plan badge */}
            {currentTier === plan.id && (
              <div className="absolute -top-3 right-4">
                <span className="bg-green-600 text-white text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Active
                </span>
              </div>
            )}

            <div className="flex-1">
              {/* Plan header */}
              <div className="text-center mb-6">
                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-2">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                <p className="text-xs text-muted-foreground">{plan.description}</p>
              </div>

              {/* Features list */}
              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Subscribe button */}
            <Button
              onClick={() => handleSubscribe(plan.id)}
              disabled={plan.disabled || isLoading}
              className={cn(
                "w-full",
                plan.popular && !plan.disabled && "bg-primary hover:bg-primary/90"
              )}
              variant={plan.disabled ? "secondary" : "default"}
            >
              {isLoading ? "Processing..." : plan.buttonText}
            </Button>
          </SpotlightArea>
        ))}
      </div>

      {/* Additional info */}
      <div className="text-center text-xs text-muted-foreground space-y-1">
        <p>All plans include secure data encryption and privacy protection</p>
        <p>Cancel anytime. No hidden fees.</p>
      </div>
    </div>
  );
};

const AgentSection: React.FC = () => {
  const AGENT_STORAGE_KEY = "agent-config";
  const AGENT_CHAT_STORAGE_KEY = "agent-chat-history";

  // Define the config type
  type AgentConfig = {
    provider: string;
    apiKey: string;
    model: string;
    baseUrl: string;
    enabled: boolean;
  };

  type AgentMessage = {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
  };

  // Agent providers - All supported by UI-TARS
  const agentProviders = [
    { id: "openai", name: "OpenAI (GPT-4)", defaultBaseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o" },
    { id: "anthropic", name: "Anthropic (Claude)", defaultBaseUrl: "https://api.anthropic.com/v1", defaultModel: "claude-3-7-sonnet-latest" },
    { id: "gemini", name: "Google Gemini", defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta", defaultModel: "gemini-2.0-flash-exp" },
    { id: "grok", name: "xAI Grok", defaultBaseUrl: "https://api.x.ai/v1", defaultModel: "grok-2-vision-1212" },
    { id: "volcengine", name: "Volcengine (Doubao)", defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3", defaultModel: "doubao-1-5-thinking-vision-pro-250428" },
    { id: "custom", name: "Custom Provider", defaultBaseUrl: "", defaultModel: "" },
  ];

  // Load saved config from localStorage
  const loadAgentConfig = (): AgentConfig => {
    try {
      const stored = localStorage.getItem(AGENT_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error("Failed to load agent config:", error);
    }
    return {
      provider: "openai",
      apiKey: "",
      model: "gpt-4o",
      baseUrl: "https://api.openai.com/v1",
      enabled: false,
    };
  };

  // Load chat history from localStorage
  const loadChatHistory = (): AgentMessage[] => {
    try {
      const stored = localStorage.getItem(AGENT_CHAT_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error("Failed to load agent chat history:", error);
    }
    return [];
  };

  const [config, setConfig] = useState<AgentConfig>(loadAgentConfig);
  const [agentStatus, setAgentStatus] = useState<"stopped" | "starting" | "running" | "error">("stopped");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [permissionsGranted, setPermissionsGranted] = useState<boolean>(false);
  const [testingAgent, setTestingAgent] = useState<boolean>(false);
  const [showConfig, setShowConfig] = useState<boolean>(true);
  const [messages, setMessages] = useState<AgentMessage[]>(loadChatHistory);
  const [inputValue, setInputValue] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [validationStatus, setValidationStatus] = useState<"idle" | "validating" | "success" | "failed">("idle");
  const validationStatusRef = useRef<"idle" | "validating" | "success" | "failed">("idle");
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  const [requireApproval, setRequireApproval] = useState<boolean>(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Save config to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error("Failed to save agent config:", error);
    }
  }, [config]);

  // Save chat history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(AGENT_CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error("Failed to save agent chat history:", error);
    }
  }, [messages]);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Define checkPermissions function
  const checkPermissions = async () => {
    // On macOS, we need Screen Recording and Accessibility permissions
    // For now, we'll assume permissions are granted if on macOS
    // In a real implementation, you would check via Tauri commands
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const hasPermissions = await invoke<boolean>('check_agent_permissions');
      setPermissionsGranted(hasPermissions);
    } catch (error) {
      // Permissions check not available or on non-macOS platform
      setPermissionsGranted(true);
    }
  };

  // Check macOS permissions status
  useEffect(() => {
    checkPermissions();
  }, []);

  // Listen for real-time UI-TARS updates
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      // Listen during both "starting" and "running" to catch validation responses
      if (agentStatus !== "running" && agentStatus !== "starting") return;

      try {
        const { listen } = await import('@tauri-apps/api/event');

        unlisten = await listen<{
          success: boolean;
          message: string;
          status: 'running' | 'completed' | 'error' | 'stopped';
          conversations?: Array<{
            role: 'system' | 'user' | 'assistant';
            content: string;
          }>;
          screenshot?: string;
          action?: string;
          thought?: string;
          loopCount?: number;
          maxLoops?: number;
          error?: string;
        }>('uitars-update', (event) => {
          const response = event.payload;

          // DEBUG: Log what we're receiving
          console.log('🔍 UI-TARS Update Received:', {
            status: response.status,
            thought: response.thought,
            action: response.action,
            loopCount: response.loopCount,
            hasScreenshot: !!response.screenshot,
            messageLength: response.message?.length,
            fullResponse: response
          });

          // Handle API key validation response
          if (response.message?.includes('✅') || response.message?.includes('❌')) {
            if (response.status === 'completed' && response.success) {
              console.log('✅ API key validation successful!');
              setValidationStatus("success");
              validationStatusRef.current = "success";

              const validationMsg: AgentMessage = {
                id: `system-${Date.now()}`,
                role: "system",
                content: response.message,
                timestamp: Date.now(),
              };
              setMessages(prev => [...prev, validationMsg]);
              return; // Don't process as regular message
            } else if (response.status === 'error' || !response.success) {
              console.error('❌ API key validation failed:', response.message);
              setValidationStatus("failed");
              validationStatusRef.current = "failed";
              setAgentStatus("error");
              setErrorMessage(response.message || response.error || "API key validation failed");

              const errorMsg: AgentMessage = {
                id: `error-${Date.now()}`,
                role: "assistant",
                content: response.message,
                timestamp: Date.now(),
              };
              setMessages(prev => [...prev, errorMsg]);
              return; // Don't process as regular message
            }
          }

          // Create detailed message from agent response
          let content = '';

          // Show loop progress
          if (response.loopCount !== undefined && response.maxLoops !== undefined) {
            content += `📊 **Step ${response.loopCount}/${response.maxLoops}**\n\n`;
          }

          // Show the agent's thinking
          if (response.thought) {
            content += `🧠 **Agent Thinking:**\n${response.thought}\n\n`;
          }

          // Show the planned action
          if (response.action) {
            content += `🎯 **Planned Action:**\n\`\`\`\n${response.action}\n\`\`\`\n\n`;
          }

          // Add screenshot if available
          if (response.screenshot) {
            content += `📸 **What Agent Sees:**\n\n![Screenshot](data:image/png;base64,${response.screenshot})\n\n`;
          }

          // Add raw message if there's additional info
          if (response.message && !response.thought && !response.action) {
            content += response.message;
          }

          const agentMessage: AgentMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content,
            timestamp: Date.now(),
          };

          setMessages(prev => [...prev, agentMessage]);

          // Handle completion or error
          if (response.status === 'completed') {
            setSending(false);
            const completionMsg: AgentMessage = {
              id: `system-${Date.now()}`,
              role: "system",
              content: "✅ **Task completed successfully**",
              timestamp: Date.now(),
            };
            setMessages(prev => [...prev, completionMsg]);
          } else if (response.status === 'error') {
            setSending(false);
            const errorMsg: AgentMessage = {
              id: `error-${Date.now()}`,
              role: "assistant",
              content: `❌ **Error:** ${response.error || response.message}`,
              timestamp: Date.now(),
            };
            setMessages(prev => [...prev, errorMsg]);
          }
        });
      } catch (error) {
        console.error("Failed to set up UI-TARS event listener:", error);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [agentStatus]);

  // Capture browser console logs and errors
  useEffect(() => {
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    const addSystemLog = (level: string, ...args: any[]) => {
      const timestamp = new Date().toLocaleTimeString();
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      const logEntry = `[${timestamp}] [${level}] ${message}`;
      setSystemLogs(prev => [...prev.slice(-99), logEntry]); // Keep last 100 logs
    };

    console.log = (...args: any[]) => {
      originalConsoleLog(...args);
      addSystemLog('LOG', ...args);
    };

    console.error = (...args: any[]) => {
      originalConsoleError(...args);
      addSystemLog('ERROR', ...args);
    };

    console.warn = (...args: any[]) => {
      originalConsoleWarn(...args);
      addSystemLog('WARN', ...args);
    };

    // Add initial message
    addSystemLog('INFO', '🚀 Agent section loaded, waiting for agent to start...');

    return () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
    };
  }, []);

  // Listen for debug logs from Rust backend
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupDebugListener = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');

        unlisten = await listen<{
          success: boolean;
          message: string;
          status: string;
        }>('uitars-debug', (event) => {
          const response = event.payload;
          const timestamp = new Date().toLocaleTimeString();
          const logEntry = `[${timestamp}] [RUST] ${response.message}`;

          setDebugLogs(prev => [...prev.slice(-49), logEntry]); // Keep last 50 logs
        });
      } catch (error) {
        console.error("Failed to set up debug listener:", error);
      }
    };

    setupDebugListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const handleProviderChange = (providerId: string) => {
    const provider = agentProviders.find(p => p.id === providerId);
    if (provider) {
      setConfig(prev => ({
        ...prev,
        provider: providerId,
        baseUrl: provider.defaultBaseUrl,
        model: provider.defaultModel,
      }));
    }
  };

  const handleStartAgent = async () => {
    if (!config.apiKey.trim()) {
      setErrorMessage("Please provide an API key");
      return;
    }

    console.log('🔍 Starting agent with validation...');
    setAgentStatus("starting");
    setErrorMessage("");
    setValidationStatus("validating");
    validationStatusRef.current = "validating";

    try {
      const { invoke } = await import('@tauri-apps/api/core');

      // Step 1: Validate API key BEFORE starting
      console.log('📡 Step 1/3: Validating API key...');

      const validatingMsg: AgentMessage = {
        id: `system-${Date.now()}`,
        role: "system",
        content: `🔑 Validating API key for **${config.provider.toUpperCase()}** with model **${config.model}**...\n\nThis ensures your API key is valid before the agent starts.`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, validatingMsg]);

      // Start the service first
      await invoke('start_uitars_agent');

      // Send validation command
      await invoke('execute_uitars_command', {
        instruction: '__VALIDATE_API__',
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl || undefined,
      });

      console.log('📤 Validation request sent, waiting for response...');

      // Wait for validation response with timeout
      const validationResult = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          console.error('⏱️ Validation timeout');
          resolve(false);
        }, 10000); // 10 second timeout

        const checkValidation = setInterval(() => {
          console.log('🔄 Checking validation status:', validationStatusRef.current);
          if (validationStatusRef.current === "success") {
            clearInterval(checkValidation);
            clearTimeout(timeout);
            resolve(true);
          } else if (validationStatusRef.current === "failed") {
            clearInterval(checkValidation);
            clearTimeout(timeout);
            resolve(false);
          }
        }, 100);
      });

      if (!validationResult) {
        setAgentStatus("error");
        if (validationStatus !== "failed") {
          setErrorMessage("Validation timeout - please check your API key and try again");
        }
        return;
      }

      console.log('✅ API key validation successful!');

      // Step 2: Check macOS permissions
      console.log('🔐 Step 2/3: Checking macOS permissions...');

      const permissionMsg: AgentMessage = {
        id: `system-${Date.now()}`,
        role: "system",
        content: `🔒 Checking macOS permissions (Screen Recording + Accessibility)...`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, permissionMsg]);

      const hasPermissions = await invoke<boolean>('check_agent_permissions');

      if (!hasPermissions) {
        setAgentStatus("error");
        setErrorMessage(
          "❌ Missing macOS Permissions!\n\n" +
          "Please grant:\n" +
          "• Screen Recording\n" +
          "• Accessibility\n\n" +
          "Go to: System Settings → Privacy & Security"
        );

        const permissionErrorMsg: AgentMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `❌ **Missing macOS Permissions**\n\nThe agent needs:\n• **Screen Recording** - to see your screen\n• **Accessibility** - to control mouse and keyboard\n\n📍 Grant permissions in:\n**System Settings → Privacy & Security**\n\nThen restart the agent.`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, permissionErrorMsg]);
        return;
      }

      console.log('✅ Permissions granted');

      // Step 3: Agent ready
      console.log('🚀 Step 3/3: Agent ready!');
      setAgentStatus("running");
      setConfig(prev => ({ ...prev, enabled: true }));

      // Add success message to chat
      const successMsg: AgentMessage = {
        id: `system-${Date.now()}`,
        role: "system",
        content: `✅ **UI-TARS Agent Ready!** Computer control powered by ${config.provider.toUpperCase()} (${config.model}).\n\n🎯 **Try these commands:**\n\n• "Open Calculator and compute 234 × 567"\n• "Open Chrome and search for 'UI-TARS Desktop'"\n• "Create a new folder called 'Agent Test' on the Desktop"\n• "Take a screenshot and describe what you see"\n\n🔧 **Capabilities:**\n• Vision: Can see your entire screen\n• Mouse: Click, drag, scroll anywhere\n• Keyboard: Type text, press hotkeys\n• Cross-platform: Works on macOS, Windows, Linux\n\n⚠️ **Safety:** Best used in a VM or dedicated display for testing.`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, successMsg]);
      setShowConfig(false);
      setValidationStatus("idle");
      validationStatusRef.current = "idle";
    } catch (error) {
      console.error("Failed to start UI-TARS agent:", error);
      setAgentStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to start UI-TARS agent");
      setValidationStatus("idle");
      validationStatusRef.current = "idle";

      const errorMsg: AgentMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `❌ **Error:** ${error instanceof Error ? error.message : "Failed to start UI-TARS agent"}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || agentStatus !== "running") return;

    const instruction = inputValue.trim();

    // Request approval if enabled
    if (requireApproval) {
      const approved = confirm(
        `⚠️ COMPUTER USE APPROVAL REQUIRED\n\n` +
        `The agent wants to execute:\n"${instruction}"\n\n` +
        `This will give the AI control of your mouse, keyboard, and screen to complete this task.\n\n` +
        `Do you approve this action?`
      );

      if (!approved) {
        console.log('❌ User denied approval for command:', instruction);

        const deniedMsg: AgentMessage = {
          id: `system-${Date.now()}`,
          role: "system",
          content: `🚫 **Action Denied** - User did not approve command: "${instruction}"`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, deniedMsg]);
        return;
      }

      console.log('✅ User approved command:', instruction);
    }

    const userMessage: AgentMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: instruction,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setSending(true);

    try {
      // Send command to UI-TARS agent
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('execute_uitars_command', {
        instruction,
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl || null,
      });

      // Real-time updates will come via uitars-update events
      // The event listener below will handle displaying responses
    } catch (error) {
      console.error("Failed to send command:", error);
      const errorMsg: AgentMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `❌ **Error sending command:**\n\n${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
      setSending(false);
    }
  };

  const handleClearChat = () => {
    if (confirm("Clear all chat history with the agent?")) {
      setMessages([]);
    }
  };

  const handleStopAgent = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('stop_uitars_agent');
      setAgentStatus("stopped");
      setConfig(prev => ({ ...prev, enabled: false }));
      setErrorMessage("");
      setSending(false);

      // Add stop message to chat
      const stopMsg: AgentMessage = {
        id: `system-${Date.now()}`,
        role: "system",
        content: "⏹️ **UI-TARS Agent stopped**",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, stopMsg]);
    } catch (error) {
      console.error("Failed to stop UI-TARS agent:", error);
      setErrorMessage(error instanceof Error ? error.message : "Failed to stop UI-TARS agent");
    }
  };

  const handleTestAgent = async () => {
    if (!config.apiKey.trim()) {
      setErrorMessage("Please provide an API key");
      return;
    }

    setTestingAgent(true);
    setErrorMessage("");

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<string>('test_agent', {
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
      });
      alert(`Agent test successful!\n\n${result}`);
    } catch (error) {
      console.error("Agent test failed:", error);
      setErrorMessage(error instanceof Error ? error.message : "Agent test failed");
    } finally {
      setTestingAgent(false);
    }
  };

  const selectedProvider = agentProviders.find(p => p.id === config.provider);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header with Status and Controls */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold">Computer Use Agent</h2>
          <p className="text-sm text-muted-foreground">
            {agentStatus === "running" ? "Chat with the autonomous computer control agent" : "Configure UI-TARS Desktop for autonomous computer control"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "px-3 py-1 rounded-full text-xs font-medium",
            agentStatus === "running" && "bg-green-500/20 text-green-700 dark:text-green-400",
            agentStatus === "stopped" && "bg-zinc-500/20 text-zinc-700 dark:text-zinc-400",
            agentStatus === "starting" && "bg-blue-500/20 text-blue-700 dark:text-blue-400",
            agentStatus === "error" && "bg-red-500/20 text-red-700 dark:text-red-400"
          )}>
            {agentStatus === "running" && "● Running"}
            {agentStatus === "stopped" && "○ Stopped"}
            {agentStatus === "starting" && "○ Starting..."}
            {agentStatus === "error" && "● Error"}
          </div>
          {agentStatus === "running" && (
            <Button size="sm" variant="ghost" onClick={() => setShowConfig(!showConfig)}>
              <Settings className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Configuration Panel - Show when agent is stopped or config is toggled */}
      {(agentStatus !== "running" || showConfig) && (
        <>
      {/* macOS Permissions Warning */}
      {!permissionsGranted && (
        <SpotlightArea className="p-4 border border-orange-500/50 rounded-md bg-orange-500/10">
          <div className="flex items-start gap-3">
            <div className="text-orange-600 dark:text-orange-400 mt-0.5">⚠️</div>
            <div className="flex-1">
              <div className="text-sm font-medium text-orange-700 dark:text-orange-300 mb-1">
                macOS Permissions Required
              </div>
              <p className="text-xs text-orange-600 dark:text-orange-400 mb-2">
                The agent needs Screen Recording and Accessibility permissions to control your computer.
              </p>
              <Button size="sm" variant="outline" onClick={checkPermissions}>
                Check Permissions
              </Button>
            </div>
          </div>
        </SpotlightArea>
      )}

      {/* Error Message */}
      {errorMessage && (
        <SpotlightArea className="p-4 border border-red-500/50 rounded-md bg-red-500/10">
          <div className="flex items-start gap-3">
            <div className="text-red-600 dark:text-red-400 mt-0.5">✕</div>
            <div className="flex-1">
              <div className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Error</div>
              <p className="text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setErrorMessage("")}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        </SpotlightArea>
      )}

      {/* Provider Selection */}
      <SpotlightArea className="p-4 border border-input/50 rounded-md bg-background/50">
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Foundation Model Provider</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Choose which AI model will control the agent's decision-making.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {agentProviders.map((provider) => (
                <button
                  key={provider.id}
                  className={cn(
                    "p-3 rounded-md border text-left transition-colors text-sm",
                    config.provider === provider.id
                      ? "border-primary bg-primary/5"
                      : "border-input/50 hover:bg-accent/40"
                  )}
                  onClick={() => handleProviderChange(provider.id)}
                >
                  <div className="font-medium">{provider.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{provider.defaultModel}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </SpotlightArea>

      {/* API Configuration */}
      <SpotlightArea className="p-4 border border-input/50 rounded-md bg-background/50">
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">API Key *</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Your {selectedProvider?.name} API key. Never shared or stored remotely.
            </p>
            <Input
              type="password"
              value={config.apiKey}
              onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="sk-..."
              className="font-mono text-sm"
            />
          </div>

          <div>
            <Label className="text-sm font-medium">Base URL</Label>
            <p className="text-xs text-muted-foreground mb-2">
              API endpoint (OpenAI-compatible). Default: {selectedProvider?.defaultBaseUrl}
            </p>
            <Input
              type="url"
              value={config.baseUrl}
              onChange={(e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
              placeholder="https://api.openai.com/v1"
              className="font-mono text-sm"
            />
          </div>

          <div>
            <Label className="text-sm font-medium">Model Name</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Specific model to use. Default: {selectedProvider?.defaultModel}
            </p>
            <Input
              value={config.model}
              onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
              placeholder="claude-3-7-sonnet-latest"
              className="font-mono text-sm"
            />
          </div>
        </div>
      </SpotlightArea>

      {/* Safety Options */}
      <SpotlightArea className="p-4 border border-input/50 rounded-md bg-background/50">
        <div className="space-y-3">
          <div className="text-sm font-medium">Safety Options</div>
          <p className="text-xs text-muted-foreground">
            Configure safety and debugging features for the agent.
          </p>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-sm font-medium">Require Approval for Commands</label>
              <p className="text-xs text-muted-foreground">Ask for confirmation before each action</p>
            </div>
            <input
              type="checkbox"
              checked={requireApproval}
              onChange={(e) => setRequireApproval(e.target.checked)}
              className="h-4 w-4"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-sm font-medium">Show Debug Logs</label>
              <p className="text-xs text-muted-foreground">Display detailed service logs for troubleshooting</p>
            </div>
            <input
              type="checkbox"
              checked={showDebugLogs}
              onChange={(e) => setShowDebugLogs(e.target.checked)}
              className="h-4 w-4"
            />
          </div>

          {showDebugLogs && debugLogs.length > 0 && (
            <div className="mt-2 p-3 bg-black/80 text-green-400 rounded font-mono text-xs max-h-40 overflow-y-auto">
              {debugLogs.map((log, i) => (
                <div key={i} className="mb-1">{log}</div>
              ))}
            </div>
          )}
        </div>
      </SpotlightArea>

      {/* Agent Controls */}
      <SpotlightArea className="p-4 border border-input/50 rounded-md bg-background/50">
        <div className="space-y-3">
          <div className="text-sm font-medium">Agent Control</div>
          <p className="text-xs text-muted-foreground">
            Start or stop the autonomous computer use agent. The agent will control mouse, keyboard, and screen.
          </p>
          <div className="flex items-center gap-2">
            {agentStatus === "stopped" || agentStatus === "error" ? (
              <>
                <Button
                  onClick={handleStartAgent}
                  size="sm"
                  disabled={!config.apiKey.trim() || !permissionsGranted}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="w-4 h-4 mr-1" />
                  Start Agent
                </Button>
                <Button
                  onClick={handleTestAgent}
                  size="sm"
                  variant="outline"
                  disabled={!config.apiKey.trim() || testingAgent}
                >
                  {testingAgent ? "Testing..." : "Test Connection"}
                </Button>
              </>
            ) : (
              <Button
                onClick={handleStopAgent}
                size="sm"
                variant="destructive"
                disabled={agentStatus === "starting"}
              >
                <X className="w-4 h-4 mr-1" />
                Stop Agent
              </Button>
            )}
          </div>
        </div>
      </SpotlightArea>

      {/* Info Section */}
      <SpotlightArea className="p-4 border border-blue-500/50 rounded-md bg-blue-500/10">
        <div className="flex items-start gap-3">
          <div className="text-blue-600 dark:text-blue-400 mt-0.5">ℹ️</div>
          <div className="flex-1">
            <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
              About Computer Use Agent
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
              <p>• The agent uses UI-TARS Desktop to control your computer via natural language</p>
              <p>• It can see your screen, move the mouse, type, and interact with applications</p>
              <p>• Powered by vision-language models (VLMs) for GUI understanding</p>
              <p>• Best used in a VM or dedicated display for safety</p>
            </div>
          </div>
        </div>
      </SpotlightArea>
        </>
      )}

      {/* Chat Interface - Show when agent is running */}
      {agentStatus === "running" && !showConfig && (
        <div className="flex-1 flex flex-col min-h-0 border border-input/50 rounded-lg overflow-hidden bg-background/50">
          {/* Chat Messages Area */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg p-3 text-sm",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : message.role === "system"
                        ? "bg-blue-500/10 border border-blue-500/50 text-blue-700 dark:text-blue-300 w-full max-w-full"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {message.role === "system" || message.role === "assistant" ? (
                      <div className="whitespace-pre-wrap prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown
                          components={{
                            img: ({ node, ...props }) => (
                              <img
                                {...props}
                                className="rounded-lg max-w-full h-auto my-2 border border-border"
                                style={{ maxHeight: '400px', objectFit: 'contain' }}
                              />
                            ),
                            code: ({ node, className, children, ...props }) => {
                              const match = /language-(\w+)/.exec(className || '');
                              return match ? (
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              ) : (
                                <code className="bg-muted px-1 py-0.5 rounded text-xs" {...props}>
                                  {children}
                                </code>
                              );
                            },
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                    <div className="text-xs opacity-60 mt-1">
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start w-full">
                  <div className="w-full rounded-lg p-4 text-sm bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/50">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="animate-pulse">🤖</div>
                        <span className="font-semibold">Agent is actively processing your request...</span>
                      </div>

                      <div className="bg-background/50 rounded p-3 space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span>Taking screenshot of your screen</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span>Analyzing visual elements</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                          <span>Planning next action with AI model</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                          <span>Waiting for detailed response...</span>
                        </div>
                      </div>

                      <div className="text-xs opacity-70">
                        💡 Updates will appear above when the agent starts thinking
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          {/* Chat Input Area */}
          <div className="p-4 border-t border-input/50 bg-background/80 backdrop-blur-sm flex-shrink-0">
            <div className="flex items-center gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Tell the agent what to do on your computer..."
                className="flex-1"
                disabled={sending || agentStatus !== "running"}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || sending || agentStatus !== "running"}
                size="sm"
              >
                Send
              </Button>
              <Button
                onClick={handleClearChat}
                variant="outline"
                size="sm"
              >
                Clear
              </Button>
              <Button
                onClick={handleStopAgent}
                variant="destructive"
                size="sm"
              >
                <X className="w-4 h-4 mr-1" />
                Stop
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DocumentsSection: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [docContent, setDocContent] = useState<string>("");
  const [viewingContent, setViewingContent] = useState(false);

  // NEW: Selection mode for adding to training
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const files = await invoke<any[]>('list_uploaded_files');
      setDocuments(files);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_uploaded_file', { fileId });
      await loadDocuments();
    } catch (error) {
      console.error('Failed to delete document:', error);
      alert('Failed to delete document');
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm(`Are you sure you want to delete all ${documents.length} documents? This cannot be undone.`)) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('wipe_uploaded_files');
      await loadDocuments();
    } catch (error) {
      console.error('Failed to delete all documents:', error);
      alert('Failed to delete all documents');
    }
  };

  const handleViewContent = async (fileId: string, fileName: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const content = await invoke<string>('extract_file_content', { fileId });
      setDocContent(content || 'No content available for this file type.');
      setSelectedDoc(fileName);
      setViewingContent(true);
    } catch (error) {
      console.error('Failed to view document content:', error);
      alert('Failed to load document content');
    }
  };

  // NEW: Selection mode functions
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    setSelectedDocs(new Set());
    setSaveSuccess(false);
    setError(null);
  };

  const toggleDocSelection = (docId: string) => {
    setSelectedDocs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const handleSaveToTraining = async () => {
    if (selectedDocs.size === 0) return;

    setSaving(true);
    setSaveSuccess(false);
    setError(null);

    try {
      const { invoke } = await import('@tauri-apps/api/core');

      // Get selected documents data
      const selectedDocsData = documents.filter(doc => selectedDocs.has(doc.id));

      // Save each document to training
      for (const doc of selectedDocsData) {
        // Extract content for the document
        const content = await invoke<string>('extract_file_content', { fileId: doc.id });  // Changed to camelCase for Tauri

        await invoke('add_document_to_training', {
          docId: doc.id,         // Changed to camelCase for Tauri
          docName: doc.name,     // Changed to camelCase for Tauri
          content: content || '',
          fileType: doc.file_type,  // Changed to camelCase for Tauri
          size: doc.size,
        });
      }

      // Success!
      setSaveSuccess(true);
      setSelectedDocs(new Set());
      setSelectionMode(false);

      // Auto-hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save to training:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to save to training'
      );
    } finally {
      setSaving(false);
    }
  };

  const getFileIcon = (fileType: string) => {
    const type = fileType.toLowerCase();
    if (['pdf', 'txt', 'md', 'rtf', 'doc', 'docx'].includes(type)) {
      return <FileText className="w-5 h-5" />;
    } else if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'php', 'html', 'css', 'json', 'xml', 'yaml', 'yml'].includes(type)) {
      return <FileCode className="w-5 h-5" />;
    } else if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'].includes(type)) {
      return <FileImage className="w-5 h-5" />;
    } else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(type)) {
      return <FileVideo className="w-5 h-5" />;
    } else if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(type)) {
      return <FileAudio className="w-5 h-5" />;
    } else {
      return <File className="w-5 h-5" />;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateString;
    }
  };

  if (viewingContent) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Document Content</h2>
            <p className="text-sm text-muted-foreground">{selectedDoc}</p>
          </div>
          <Button onClick={() => setViewingContent(false)} size="sm" variant="secondary">
            <X className="w-4 h-4 mr-1" />
            Close
          </Button>
        </div>
        <SpotlightArea className="p-4 border border-input/50 rounded-md bg-background/50 max-h-[600px] overflow-auto">
          <pre className="text-xs whitespace-pre-wrap font-mono">{docContent}</pre>
        </SpotlightArea>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Documents</h2>
          <p className="text-sm text-muted-foreground">
            All documents uploaded to ArkAngel. These documents can be used as context in conversations.
          </p>
        </div>
        <div className="flex gap-2">
          {documents.length > 0 && (
            <Button onClick={handleDeleteAll} size="sm" variant="destructive">
              <Trash2 className="w-4 h-4 mr-1" />
              Delete All
            </Button>
          )}
        </div>
      </div>

      {/* Add to Training Button */}
      {documents.length > 0 && (
        <div className="mb-4">
          <Button
            onClick={
              selectionMode && selectedDocs.size > 0
                ? handleSaveToTraining
                : toggleSelectionMode
            }
            variant={selectionMode && selectedDocs.size > 0 ? "default" : "outline"}
            className="w-full"
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : saveSuccess ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Saved to Training!
              </>
            ) : selectionMode ? (
              selectedDocs.size > 0 ? (
                <>Save {selectedDocs.size} to Training</>
              ) : (
                <>Cancel Selection</>
              )
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add to Training
              </>
            )}
          </Button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        <SpotlightArea className="p-12 border border-input/50 rounded-md bg-background/50 flex items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading documents...</div>
        </SpotlightArea>
      ) : documents.length === 0 ? (
        <SpotlightArea className="p-12 border border-input/50 rounded-md bg-background/50 flex flex-col items-center justify-center">
          <File className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <p className="text-lg text-muted-foreground">No documents uploaded yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Upload documents from the main chat interface to see them here
          </p>
        </SpotlightArea>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <SpotlightArea
              key={doc.id}
              className={cn(
                "p-4 border border-input/50 rounded-md bg-background/50 transition-colors",
                selectionMode ? "cursor-pointer hover:bg-accent/40" : "hover:bg-accent/20",
                selectionMode && selectedDocs.has(doc.id) && "bg-primary/10 border-primary"
              )}
              onClick={() => selectionMode && toggleDocSelection(doc.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Checkbox in selection mode */}
                  {selectionMode && (
                    <div className="mt-1">
                      {selectedDocs.has(doc.id) ? (
                        <CheckSquare className="w-5 h-5 text-primary" />
                      ) : (
                        <Square className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  )}

                  <div className="mt-1 text-primary">
                    {getFileIcon(doc.file_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate" title={doc.name}>
                      {doc.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                      <span className="uppercase font-mono">{doc.file_type}</span>
                      <span>{formatFileSize(doc.size)}</span>
                      <span>{formatDate(doc.upload_date)}</span>
                      {doc.is_context_enabled && (
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
                          Context Enabled
                        </span>
                      )}
                    </div>
                    {doc.summary && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {doc.summary}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action buttons (hidden in selection mode) */}
                {!selectionMode && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      onClick={() => handleViewContent(doc.id, doc.name)}
                      size="sm"
                      variant="ghost"
                      title="View content"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => handleDeleteDocument(doc.id)}
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </SpotlightArea>
          ))}
        </div>
      )}

      {documents.length > 0 && (
        <div className="pt-2">
          <p className="text-xs text-muted-foreground text-center">
            {documents.length} document{documents.length !== 1 ? 's' : ''} stored locally
          </p>
        </div>
      )}
    </div>
  );
};

const TranscriptsSection: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-2">Conversation Transcripts</h2>
        <p className="text-sm text-muted-foreground">
          View all your past conversation transcripts organized in easy-to-read batches.
          Each transcript is automatically split into sections based on content flow.
        </p>
      </div>

      <div className="h-[calc(100vh-240px)]">
        <TranscriptViewer />
      </div>
    </div>
  );
};

type DataTypeFilter = 'all' | 'documents' | 'transcripts';

interface RagPersona {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  source_count: number;
  chunk_count: number;
  embedding_model: string;
}

const TrainingSection: React.FC = () => {
  const [trainingItems, setTrainingItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [viewingItem, setViewingItem] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<DataTypeFilter>('all');
  const [showWizard, setShowWizard] = useState(false);
  const [ragPersonas, setRagPersonas] = useState<RagPersona[]>([]);
  const [ragLoading, setRagLoading] = useState(true);
  const [deletingPersonaId, setDeletingPersonaId] = useState<string | null>(null);

  useEffect(() => {
    loadTrainingData();
    loadRagPersonas();
  }, []);

  const loadTrainingData = async () => {
    setLoading(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const items = await invoke<any[]>('list_training_data');
      const statistics = await invoke<any>('get_training_stats');
      setTrainingItems(items);
      setStats(statistics);
    } catch (error) {
      console.error('Failed to load training data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRagPersonas = async () => {
    setRagLoading(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const personas = await invoke<RagPersona[]>('list_rag_personas');
      setRagPersonas(personas);
    } catch (error) {
      console.error('Failed to load RAG personas:', error);
    } finally {
      setRagLoading(false);
    }
  };

  const handleDeletePersona = async (personaId: string) => {
    if (deletingPersonaId !== personaId) {
      setDeletingPersonaId(personaId);
      setTimeout(() => setDeletingPersonaId(null), 3000);
      return;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_rag_persona', { personaId });
      await loadRagPersonas();
      setDeletingPersonaId(null);
    } catch (error) {
      console.error('Failed to delete RAG persona:', error);
      alert('Failed to delete persona');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (deleteConfirm !== itemId) {
      setDeleteConfirm(itemId);
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_training_item', { itemId });
      await loadTrainingData();
      setDeleteConfirm(null);
      if (viewingItem?.id === itemId) {
        setViewingItem(null);
      }
    } catch (error) {
      console.error('Failed to delete training item:', error);
      alert('Failed to delete training item');
    }
  };

  const handleClearAll = async () => {
    if (!confirm(`Are you sure you want to delete all ${trainingItems.length} training items? This cannot be undone.`)) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('clear_all_training_data');
      await loadTrainingData();
      setViewingItem(null);
    } catch (error) {
      console.error('Failed to clear training data:', error);
      alert('Failed to clear training data');
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateString;
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Filter training items by type
  const filteredItems = trainingItems.filter(item => {
    if (filterType === 'all') return true;
    if (filterType === 'documents') return item.source_type === 'document';
    if (filterType === 'transcripts') return item.source_type === 'transcript';
    return true;
  });

  const documentCount = trainingItems.filter(i => i.source_type === 'document').length;
  const transcriptCount = trainingItems.filter(i => i.source_type === 'transcript').length;

  if (viewingItem) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Training Data Content</h2>
            <p className="text-sm text-muted-foreground">{viewingItem.title}</p>
          </div>
          <Button onClick={() => setViewingItem(null)} size="sm" variant="secondary">
            <X className="w-4 h-4 mr-1" />
            Close
          </Button>
        </div>
        <SpotlightArea className="p-4 border border-input/50 rounded-md bg-background/50">
          <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
            <div>
              <span className="text-muted-foreground">Source Type:</span>
              <span className="ml-2 font-medium">{viewingItem.source_type}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Format:</span>
              <span className="ml-2 font-medium">{viewingItem.format}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Added:</span>
              <span className="ml-2 font-medium">{formatDate(viewingItem.added_at)}</span>
            </div>
            {viewingItem.metadata?.message_count && (
              <div>
                <span className="text-muted-foreground">Messages:</span>
                <span className="ml-2 font-medium">{viewingItem.metadata.message_count}</span>
              </div>
            )}
          </div>
        </SpotlightArea>
        <SpotlightArea className="p-4 border border-input/50 rounded-md bg-background/50 max-h-[600px] overflow-auto">
          <pre className="text-xs whitespace-pre-wrap font-mono">{viewingItem.content}</pre>
        </SpotlightArea>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Training Data</h2>
          <p className="text-sm text-muted-foreground">
            View and manage data collected for future RAG system and model training.
            This data is stored in RAG-optimized JSON format.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {trainingItems.length > 0 && (
            <>
              <Button onClick={() => setShowWizard(true)} size="sm" variant="default">
                <Plus className="w-4 h-4 mr-1" />
                Start Training
              </Button>
              <Button onClick={handleClearAll} size="sm" variant="destructive">
                <Trash2 className="w-4 h-4 mr-1" />
                Clear All
              </Button>
            </>
          )}
        </div>
      </div>

      {/* RAG Personas Section */}
      {ragLoading ? (
        <div className="p-4 text-center text-sm text-muted-foreground">
          Loading RAG personas...
        </div>
      ) : ragPersonas.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-semibold">RAG Personas</h3>
            <span className="text-xs text-muted-foreground">
              {ragPersonas.length} persona{ragPersonas.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {ragPersonas.map((persona) => {
              const createdDate = new Date(persona.created_at);
              const formattedDate = createdDate.toLocaleDateString();

              return (
                <SpotlightArea
                  key={persona.id}
                  className="p-4 border border-input/50 rounded-md bg-background/50 hover:bg-accent/10 transition-colors"
                >
                  <div className="flex flex-col h-full">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate" title={persona.name}>
                          {persona.name}
                        </h4>
                      </div>
                      <Button
                        onClick={() => handleDeletePersona(persona.id)}
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive ml-2 flex-shrink-0"
                        title={deletingPersonaId === persona.id ? "Click again to confirm" : "Delete persona"}
                      >
                        {deletingPersonaId === persona.id ? (
                          <span className="text-xs">Confirm?</span>
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>

                    {persona.description && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                        {persona.description}
                      </p>
                    )}

                    <div className="mt-auto space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Sources:</span>
                        <span className="font-medium">{persona.source_count}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Chunks:</span>
                        <span className="font-medium">{persona.chunk_count}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Model:</span>
                        <span className="font-mono text-[10px]">{persona.embedding_model}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-input/30">
                        <span className="text-muted-foreground">Created:</span>
                        <span>{formattedDate}</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-input/30">
                      <Button
                        onClick={() => {
                          // TODO: Navigate to Angel Profiles and link this RAG persona
                          console.log("Use persona:", persona.id);
                        }}
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                      >
                        <Star className="w-3 h-3 mr-1" />
                        Use in Angel Profiles
                      </Button>
                    </div>
                  </div>
                </SpotlightArea>
              );
            })}
          </div>
        </div>
      ) : null}

      {stats && (
        <SpotlightArea className="p-4 border border-input/50 rounded-md bg-primary/5">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-foreground">{stats.total_count}</div>
              <div className="text-xs text-muted-foreground">Total Items</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{formatBytes(stats.total_size_bytes)}</div>
              <div className="text-xs text-muted-foreground">Total Size</div>
            </div>
            <div>
              <div className="text-xs font-medium text-foreground">{formatDate(stats.last_updated)}</div>
              <div className="text-xs text-muted-foreground">Last Updated</div>
            </div>
          </div>
        </SpotlightArea>
      )}

      {/* Data Type Filters */}
      {trainingItems.length > 0 && (
        <div className="flex gap-2">
          <Button
            variant={filterType === 'all' ? 'default' : 'outline'}
            onClick={() => setFilterType('all')}
            size="sm"
          >
            All ({trainingItems.length})
          </Button>
          <Button
            variant={filterType === 'documents' ? 'default' : 'outline'}
            onClick={() => setFilterType('documents')}
            size="sm"
          >
            Documents ({documentCount})
          </Button>
          <Button
            variant={filterType === 'transcripts' ? 'default' : 'outline'}
            onClick={() => setFilterType('transcripts')}
            size="sm"
          >
            Transcripts ({transcriptCount})
          </Button>
        </div>
      )}

      {loading ? (
        <SpotlightArea className="p-12 border border-input/50 rounded-md bg-background/50 flex items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading training data...</div>
        </SpotlightArea>
      ) : trainingItems.length === 0 ? (
        <SpotlightArea className="p-12 border border-input/50 rounded-md bg-background/50 flex flex-col items-center justify-center">
          <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <p className="text-lg text-muted-foreground">No training data yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add documents and transcripts to build your training dataset
          </p>
        </SpotlightArea>
      ) : filteredItems.length === 0 ? (
        <SpotlightArea className="p-12 border border-input/50 rounded-md bg-background/50 flex flex-col items-center justify-center">
          <FileText className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <p className="text-lg text-muted-foreground">No {filterType} found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try selecting a different filter
          </p>
        </SpotlightArea>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <SpotlightArea
              key={item.id}
              className="p-4 border border-input/50 rounded-md bg-background/50 hover:bg-accent/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-1 text-primary">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate" title={item.title}>
                      {item.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                      <span className="uppercase font-mono">{item.source_type}</span>
                      <span className="uppercase font-mono">{item.format}</span>
                      <span>{formatDate(item.added_at)}</span>
                      {item.metadata?.message_count && (
                        <span>{item.metadata.message_count} messages</span>
                      )}
                      {item.metadata?.source_date && (
                        <span>From {item.metadata.source_date}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    onClick={() => setViewingItem(item)}
                    size="sm"
                    variant="ghost"
                    title="View content"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => handleDeleteItem(item.id)}
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    title={deleteConfirm === item.id ? "Click again to confirm" : "Delete item"}
                  >
                    {deleteConfirm === item.id ? (
                      <span className="text-xs px-2">Confirm?</span>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </SpotlightArea>
          ))}
        </div>
      )}

      {trainingItems.length > 0 && (
        <div className="pt-2">
          <p className="text-xs text-muted-foreground text-center">
            {trainingItems.length} training item{trainingItems.length !== 1 ? 's' : ''} stored in RAG-optimized format
          </p>
        </div>
      )}

      {/* Create Persona Wizard */}
      {showWizard && (
        <CreatePersonaWizard
          trainingItems={trainingItems}
          onClose={() => setShowWizard(false)}
          onComplete={(personaId) => {
            console.log("Persona created:", personaId);
            setShowWizard(false);
            loadRagPersonas(); // Reload personas to show the new one
          }}
        />
      )}
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
