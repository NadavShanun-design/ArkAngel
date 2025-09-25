import { Persona, SettingsState } from "@/types";
import { DEFAULT_SYSTEM_PROMPT, STORAGE_KEYS } from "@/config";
import { nanoid } from "nanoid/non-secure"; // lightweight id (nanoid installed? if not we'll fallback)

// Fallback simple id if nanoid isn't available at runtime
function fallbackId() {
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}

// Safe ID generator
export function generatePersonaId() {
  try {
    return nanoid(10);
  } catch {
    return fallbackId();
  }
}

// Basic summary generator: attempt to extract first 2 sentences or cap length
export function summarizePrompt(prompt: string): string {
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Empty persona prompt.";
  // Split into sentences
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
  const summary = sentences.slice(0, 2).join(" ").trim();
  return summary.length > 260 ? summary.slice(0, 257) + "..." : summary;
}

export function buildDefaultPersonas(existingSystemPrompt?: string): Persona[] {
  const now = Date.now();
  const defaults: Omit<Persona, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      name: "Professor",
      prompt: `You are a senior university professor with deep expertise across computer science, mathematics, and interdisciplinary innovation. You explain complex ideas with layered clarity: start with intuition, add structure, then formal detail. You cite foundational principles and encourage critical thinking. Always be precise, academically rigorous, and encouraging.`,
      summary: "A senior university professor who explains complex topics with layered clarity, academic rigor, and encouragement.",
      isDefault: true,
    },
    {
      name: "Cofounder",
      prompt: `You are a pragmatic, visionary startup cofounder. You think in terms of product velocity, user pain, differentiation, defensibility, and capital efficiency. You challenge assumptions directly but constructively. Your answers blend strategic framing with actionable next steps and lean validation tactics.`,
      summary: "A pragmatic startup cofounder focused on velocity, user pain, differentiation, and actionable strategic execution.",
      isDefault: true,
    },
    {
      name: "Friend",
      prompt: `You are a supportive, grounded friend. You listen first, respond with empathy, and offer gentle perspective. You avoid empty platitudes—responses feel human, warm, and emotionally intelligent. You help reframe anxieties into realistic next steps.`,
      summary: "An empathetic, emotionally intelligent friend offering grounded support and perspective.",
      isDefault: true,
    },
    {
      name: "Assistant",
      prompt: `You are an ultra-efficient executive assistant. You summarize crisply, prioritize decisions, propose structured plans, and request clarifications only when necessary. Always optimize for time, clarity, and follow-through. Maintain a professional, calm tone.`,
      summary: "An efficient executive assistant delivering crisp summaries, structured plans, and calm professionalism.",
      isDefault: true,
    },
    {
      name: "Research Analyst",
      prompt: `You are a meticulous research analyst synthesizing information across credible sources. You compare viewpoints, note uncertainties, and structure outputs in scannable formats (bullets, tables, tiers). You are neutral, precise, and bias-aware.`,
      summary: "A neutral research analyst who synthesizes information with structure, precision, and bias awareness.",
      isDefault: true,
    },
  ];

  // If there was an existing custom system prompt, offer it as a migrated persona
  if (existingSystemPrompt?.trim() && existingSystemPrompt !== DEFAULT_SYSTEM_PROMPT) {
    defaults.unshift({
      name: "Migrated Prompt",
      prompt: existingSystemPrompt.trim(),
      summary: summarizePrompt(existingSystemPrompt),
      isDefault: false,
    });
  }

  return defaults.map(d => ({
    id: generatePersonaId(),
    createdAt: now,
    updatedAt: now,
    ...d,
  }));
}

export function migrateSettingsToPersonas(settings: SettingsState): SettingsState {
  if (settings.personas && settings.personas.length > 0 && settings.currentPersonaId) {
    return settings; // already migrated
  }
  const personas = buildDefaultPersonas(settings.systemPrompt || DEFAULT_SYSTEM_PROMPT);
  const active = personas[0];
  return {
    ...settings,
    personas,
    currentPersonaId: active.id,
    systemPrompt: active.prompt, // keep for backward compatibility with code paths still using systemPrompt
  };
}

export function getActivePersona(settings: SettingsState | null | undefined): Persona | null {
  if (!settings?.personas || !settings.currentPersonaId) return null;
  return settings.personas.find(p => p.id === settings.currentPersonaId) || null;
}

export function updatePersona(list: Persona[], id: string, updates: Partial<Persona>): Persona[] {
  return list.map(p => p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p);
}

export function addPersona(list: Persona[], persona: Omit<Persona, 'id' | 'createdAt' | 'updatedAt' | 'summary'> & { summary?: string }): Persona[] {
  const id = generatePersonaId();
  const now = Date.now();
  const prompt = persona.prompt.trim();
  return [
    ...list,
    {
      id,
      name: persona.name.trim() || "Untitled Persona",
      prompt,
      summary: persona.summary || summarizePrompt(prompt),
      createdAt: now,
      updatedAt: now,
      isDefault: persona.isDefault || false,
    }
  ];
}

export function removePersona(list: Persona[], id: string): Persona[] {
  return list.filter(p => p.id !== id);
}

// Storage helpers (local only for now)
export function loadPersonas(): Persona[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.personas || [];
  } catch {
    return [];
  }
}

