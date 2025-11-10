// Storage keys
export const STORAGE_KEYS = {
  SETTINGS: "settings",
  THEME: "theme",
  CHAT_HISTORY: "chat_history",
  CUSTOM_PROVIDERS: "custom_providers",
  DESIGN_ACCENT: "design_accent", // 'bw' | 'rainbow'
  DESIGN_GRADIENT: "design_gradient", // 'bw' | 'rainbow'
} as const;

// Available AI providers
export const providers = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com",
    chatEndpoint: "/v1/chat/completions",
    authType: "bearer",
    defaultModel: "gpt-5",
    response: {
      contentPath: "choices[0].message.content",
      usagePath: "usage",
    },
    input: {
      text: {
        placement:
          "messages array (as string content in user/assistant messages)",
        exampleStructure: {
          role: "user",
          content: "Your text message here",
        },
      },
      image: {
        type: "url_or_base64",
        placement:
          "messages array (as content items in user/assistant messages; content becomes array when including images)",
        exampleStructure: {
          role: "user",
          content: [
            { type: "text", text: "Describe this image:" },
            {
              type: "image_url",
              image_url: { url: "https://example.com/image.jpg" },
            },
          ],
        },
      },
    },
    models: {
      endpoint: "/v1/models",
      method: "GET",
      responsePath: "data",
      idKey: "id",
    },
  },
  {
    id: "claude",
    name: "Claude (Anthropic)",
    baseUrl: "https://api.anthropic.com",
    chatEndpoint: "/v1/messages",
    authType: "x-api-key",
    defaultModel: "claude-sonnet-4-20250514",
    response: {
      contentPath: "content[0].text",
      usagePath: "usage",
    },
    input: {
      text: {
        placement:
          "messages array (as string content in user/assistant messages)",
        exampleStructure: {
          role: "user",
          content: "Your text message here",
        },
      },
      image: {
        type: "base64",
        placement:
          "messages array (as content items in user messages; content becomes array when including images)",
        exampleStructure: {
          role: "user",
          content: [
            { type: "text", text: "Describe this image:" },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: "base64_string_here",
              },
            },
          ],
        },
      },
    },
    models: null,
  },
  {
    id: "grok",
    name: "Grok (xAI)",
    baseUrl: "https://api.x.ai",
    chatEndpoint: "/v1/chat/completions",
    authType: "bearer",
    defaultModel: "grok-4",
    response: {
      contentPath: "choices[0].message.content",
      usagePath: "usage",
    },
    input: {
      text: {
        placement:
          "messages array (as string content in user/assistant messages)",
        exampleStructure: {
          role: "user",
          content: "Your text message here",
        },
      },
      image: {
        type: "url_or_base64",
        placement:
          "messages array (as content items in user/assistant messages; content becomes array when including images)",
        exampleStructure: {
          role: "user",
          content: [
            { type: "text", text: "Describe this image:" },
            {
              type: "image_url",
              image_url: { url: "https://example.com/image.jpg" },
            },
          ],
        },
      },
    },
    models: {
      endpoint: "/v1/models",
      method: "GET",
      responsePath: "data",
      idKey: "id",
    },
  },
  {
    id: "groq",
    name: "Groq ⚡ (Fastest)",
    baseUrl: "https://api.groq.com/openai/v1",
    chatEndpoint: "/chat/completions",
    authType: "bearer",
    defaultModel: "llama-3.3-70b-versatile",
    response: {
      contentPath: "choices[0].message.content",
      usagePath: "usage",
    },
    input: {
      text: {
        placement:
          "messages array (as string content in user/assistant messages)",
        exampleStructure: {
          role: "user",
          content: "Your text message here",
        },
      },
      image: {
        type: "url_or_base64",
        placement:
          "messages array (as content items in user/assistant messages; content becomes array when including images)",
        exampleStructure: {
          role: "user",
          content: [
            { type: "text", text: "Describe this image:" },
            {
              type: "image_url",
              image_url: { url: "https://example.com/image.jpg" },
            },
          ],
        },
      },
    },
    models: {
      endpoint: "/models",
      method: "GET",
      responsePath: "data",
      idKey: "id",
    },
  },
  {
    id: "gemini",
    name: "Gemini (Google)",
    baseUrl: "https://generativelanguage.googleapis.com",
    chatEndpoint: "/v1beta/models/${model}:streamGenerateContent?alt=sse",
    authType: "x-goog-api-key",
    authParam: "key",
    defaultModel: "gemini-2.5-flash",
    response: {
      contentPath: "candidates[0].content.parts[0].text",
      usagePath: "usageMetadata",
    },
    input: {
      text: {
        placement: "contents array (as text parts in user/model contents)",
        exampleStructure: {
          role: "user",
          parts: [{ text: "Your text message here" }],
        },
      },
      image: {
        type: "url_or_base64",
        placement: "contents array (as parts in user contents)",
        exampleStructure: {
          role: "user",
          parts: [
            { text: "Describe this image:" },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: "base64_string_here",
              },
            },
          ],
        },
      },
    },
    models: {
      endpoint: "/v1beta/models",
      method: "GET",
      responsePath: "models",
      idKey: "name",
    },
  },
  {
    id: "custom",
    name: "Custom Provider",
    baseUrl: "",
    chatEndpoint: "",
    authType: "bearer",
    defaultModel: "",
    response: {
      contentPath: "",
      usagePath: "",
    },
    input: {
      text: {
        placement: "",
        exampleStructure: {},
      },
      image: {
        type: "",
        placement: "",
        exampleStructure: {},
      },
    },
    models: null,
    isCustom: true,
  },
];

// Default settings
export const DEFAULT_SYSTEM_PROMPT = `You are ArkAngel, an advanced AI assistant with access to powerful productivity tools and integrations.

CAPABILITIES:
- Calendar management and scheduling (create, update, view events)
- Email composition and management via Gmail
- Web research and information gathering
- File analysis and processing
- Code assistance and debugging
- Real-time tool execution via MCP (Model Context Protocol)

BEHAVIOR GUIDELINES:
- Always consider the current date/time context when scheduling or working with time-sensitive tasks
- Be proactive in suggesting relevant actions based on user needs
- Explain your reasoning when using tools or making decisions
- Ask clarifying questions when user intent is unclear
- Maintain a professional but friendly and helpful tone
- Prioritize user privacy and security when handling sensitive information

When working with calendar events, always specify timezones clearly and confirm scheduling details with the user.`