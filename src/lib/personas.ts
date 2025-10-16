import { Persona } from "@/types";

// Generate a 1-2 sentence summary from a prompt using simple heuristics
export const generateSummary = (prompt: string): string => {
  if (!prompt.trim()) return "An AI assistant persona.";
  
  // Clean up the prompt
  const cleaned = prompt.trim().replace(/\n\n+/g, '\n').replace(/\n/g, ' ');
  
  // Extract first meaningful sentence or two
  const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  if (sentences.length === 0) {
    return "An AI assistant persona.";
  }
  
  // Take first sentence and potentially second if it's short
  let summary = sentences[0].trim();
  if (sentences.length > 1 && sentences[1].trim().length < 50) {
    summary += ". " + sentences[1].trim();
  }
  
  // Ensure it ends with punctuation
  if (!summary.match(/[.!?]$/)) {
    summary += ".";
  }
  
  // Limit length
  if (summary.length > 120) {
    summary = summary.substring(0, 117) + "...";
  }
  
  return summary;
};

// Default personas
export const createDefaultPersonas = (existingPrompt?: string): Persona[] => {
  const personas: Persona[] = [
    {
      id: "professor",
      name: "Professor",
      prompt: "You are a knowledgeable university professor with expertise across multiple disciplines. You explain complex concepts clearly, provide detailed analysis with academic rigor, and encourage critical thinking. Always cite relevant sources when possible and break down information into digestible parts for better understanding.",
      summary: "A knowledgeable university professor who explains complex concepts with academic rigor and encourages critical thinking.",
      isDefault: true,
    },
    {
      id: "cofounder", 
      name: "Cofounder",
      prompt: "You are an experienced startup co-founder with deep business acumen. You think strategically about growth, product-market fit, and scaling challenges. You provide actionable insights on business operations, team building, fundraising, and market analysis. You balance optimism with realistic assessments and focus on practical solutions.",
      summary: "An experienced startup co-founder who provides strategic business insights and actionable advice on growth and operations.",
      isDefault: true,
    },
    {
      id: "friend",
      name: "Friend", 
      prompt: "You are a supportive, understanding friend who listens actively and provides thoughtful advice. You're conversational, empathetic, and genuine in your responses. You celebrate successes, offer comfort during challenges, and help think through personal decisions with care and wisdom.",
      summary: "A supportive and empathetic friend who provides thoughtful advice and genuine conversation.",
      isDefault: true,
    },
    {
      id: "assistant",
      name: "Assistant",
      prompt: "You are a professional, efficient assistant focused on productivity and task completion. You organize information clearly, provide step-by-step guidance, and help prioritize tasks. You're detail-oriented, proactive in suggesting solutions, and always aim to make your user's work easier and more organized.",
      summary: "A professional assistant focused on productivity, organization, and efficient task completion.", 
      isDefault: true,
    },
    {
      id: "analyst",
      name: "Research Analyst", 
      prompt: "You are a thorough research analyst who excels at gathering, synthesizing, and presenting information. You approach topics methodically, identify key insights from data, and present findings in well-structured reports. You ask clarifying questions to ensure accuracy and provide evidence-based recommendations.",
      summary: "A thorough research analyst who synthesizes information methodically and provides evidence-based insights.",
      isDefault: true,
    },
  ];

  // If there's an existing prompt, create a "Custom" persona from it
  if (existingPrompt?.trim() && existingPrompt.trim() !== "") {
    personas.unshift({
      id: "migrated-custom",
      name: "Legacy Custom",
      prompt: existingPrompt,
      summary: generateSummary(existingPrompt),
      isDefault: false,
    });
  }

  return personas;
};

// CRUD operations for personas
export const createPersona = (name: string, prompt: string): Persona => {
  return {
    id: `persona-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    name: name.trim() || "Unnamed Persona",
    prompt: prompt.trim(),
    summary: generateSummary(prompt),
    isDefault: false,
  };
};

export const updatePersona = (persona: Persona, updates: Partial<Pick<Persona, 'name' | 'prompt'>>): Persona => {
  const updated = { ...persona, ...updates };
  
  // Regenerate summary if prompt changed
  if (updates.prompt !== undefined) {
    updated.summary = generateSummary(updated.prompt);
  }
  
  return updated;
};

export const deletePersona = (personas: Persona[], personaId: string): Persona[] => {
  return personas.filter(p => p.id !== personaId);
};

export const findPersonaById = (personas: Persona[], personaId: string): Persona | undefined => {
  return personas.find(p => p.id === personaId);
};

// Migration helper
export const migrateToPersonas = (existingSystemPrompt?: string): { personas: Persona[]; currentPersonaId: string } => {
  const personas = createDefaultPersonas(existingSystemPrompt);
  
  // If we migrated an existing prompt, use it as current
  const currentPersonaId = existingSystemPrompt?.trim() ? "migrated-custom" : "assistant";
  
  return { personas, currentPersonaId };
};