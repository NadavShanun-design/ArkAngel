import { Persona, SettingsState } from "@/types";
import { DEFAULT_SYSTEM_PROMPT, STORAGE_KEYS } from "@/config";

function generateId() {
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}

export function summarizePrompt(prompt: string): string {
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Empty persona.";
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
  const summary = sentences.slice(0, 2).join(" ").trim();
  return summary.length > 260 ? summary.slice(0, 257) + "..." : summary;
}

export function defaultPersonas(existing?: string): Persona[] {
  const now = Date.now();
  const base: Omit<Persona, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      name: "Professor",
      prompt: `You are a senior university professor with deep interdisciplinary expertise. You explain complex concepts in layered steps: intuition → structure → formal detail. Always be precise, rigorous, and encouraging.`,
      summary: "An academic professor giving layered, rigorous, and encouraging explanations.",
      isDefault: true,
    },
    {
      name: "Cofounder",
      prompt: `You are a pragmatic startup cofounder. You focus on user pain, differentiation, velocity, and capital efficiency. Challenge assumptions constructively and produce actionable next steps.`,
      summary: "A pragmatic cofounder focused on user pain, differentiation, and actionable execution.",
      isDefault: true,
    },
    {
      name: "Friend",
      prompt: `You are a supportive friend. You listen first, respond with empathy, avoid hollow platitudes, and help reframe anxieties into grounded next steps.`,
      summary: "An empathetic friend offering grounded emotional support.",
      isDefault: true,
    },
    {
      name: "Assistant",
      prompt: `You are an efficient executive assistant. Provide crisp summaries, structured plans, prioritization, and only necessary clarifications. Maintain a calm, professional tone.`,
      summary: "An efficient executive assistant with concise, structured output.",
      isDefault: true,
    },
    {
      name: "Research Analyst",
      prompt: `You are a neutral research analyst synthesizing credible sources. Compare perspectives, note uncertainties, and format output for fast scanning (bullets, tables where helpful).`,
      summary: "A neutral research analyst producing structured, bias-aware synthesis.",
      isDefault: true,
    },
  ];

  const list = base.map(p => ({ id: generateId(), createdAt: now, updatedAt: now, ...p }));
  if (existing && existing.trim() && existing !== DEFAULT_SYSTEM_PROMPT) {
    list.unshift({
      id: generateId(),
      name: "Migrated Prompt",
      prompt: existing.trim(),
      summary: summarizePrompt(existing),
      createdAt: now,
      updatedAt: now,
      isDefault: false,
    });
  }
  return list;
}

export function migrateSettings(settings: SettingsState): SettingsState {
  if (settings.personas && settings.personas.length && settings.currentPersonaId) return settings;
  const personas = defaultPersonas(settings.systemPrompt || DEFAULT_SYSTEM_PROMPT);
  const active = personas[0];
  return { ...settings, personas, currentPersonaId: active.id, systemPrompt: active.prompt };
}

export function getActivePersona(settings?: SettingsState | null): Persona | null {
  if (!settings?.personas || !settings.currentPersonaId) return null;
  return settings.personas.find(p => p.id === settings.currentPersonaId) || null;
}

export function updatePersona(list: Persona[], id: string, updates: Partial<Persona>): Persona[] {
  return list.map(p => p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p);
}

export function addPersona(list: Persona[], data: { name: string; prompt: string }): Persona[] {
  const now = Date.now();
  const prompt = data.prompt.trim();
  return [...list, { id: generateId(), name: data.name.trim() || "Untitled", prompt, summary: summarizePrompt(prompt), createdAt: now, updatedAt: now }];
}

export function removePersona(list: Persona[], id: string): Persona[] {
  return list.filter(p => p.id !== id);
}

export function persistSettings(next: SettingsState) {
  try { localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(next)); } catch {}
}
