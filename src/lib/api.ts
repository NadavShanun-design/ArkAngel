import { loadCustomProvidersFromStorage } from "./storage";
import { providers } from "@/config";
// get nested value from object
const getNestedValue = (obj: any, path: string): any => {
  return path.split(".").reduce((current, key) => {
    if (key.includes("[") && key.includes("]")) {
      const arrayKey = key.substring(0, key.indexOf("["));
      const index = parseInt(
        key.substring(key.indexOf("[") + 1, key.indexOf("]"))
      );
      return current?.[arrayKey]?.[index];
    }
    return current?.[key];
  }, obj);
};

// get provider by id (includes custom providers)
export const getProviderById = (providerId: string) => {
  // First check custom providers
  const customProviders = loadCustomProvidersFromStorage();
  const customProvider = customProviders.find((p) => p.id === providerId);
  if (customProvider) {
    return customProvider;
  }

  return providers.find((p: any) => p.id === providerId);
};

// fetch models from provider API
export async function fetchModels(
  provider: any,
  apiKey: string
): Promise<string[]> {
  // if provider doesn't support model fetching, return empty array
  if (!provider.models) {
    throw new Error("Provider does not support model fetching");
  }

  let url = `${provider.baseUrl}${provider.models.endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // handle authentication based on provider type
  if (provider.authType === "bearer") {
    headers["Authorization"] = `Bearer ${apiKey}`;
  } else if (provider.authType === "x-api-key") {
    headers["x-api-key"] = apiKey;
  } else if (provider.authType === "x-goog-api-key") {
    headers["x-goog-api-key"] = apiKey;
  } else if (
    provider.authType === "custom-header" &&
    provider.customHeaderName
  ) {
    headers[provider.customHeaderName] = apiKey;
  } else if (provider.authType === "query" && provider.authParam) {
    url += `?${provider.authParam}=${apiKey}`;
  }

  const response = await fetch(url, {
    method: provider.models.method || "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch models: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();

  // extract models array using the response path
  const modelsArray = getNestedValue(data, provider.models.responsePath) || [];

  if (!Array.isArray(modelsArray)) {
    throw new Error("Invalid response format: models data is not an array");
  }

  // extract model IDs using the specified ID key
  return modelsArray
    .map((model: any) => model[provider.models.idKey])
    .filter((id: string) => id && typeof id === "string")
    .sort();
}

// convert Float32Array to WAV blob
const floatArrayToWav = (
  audioData: Float32Array,
  sampleRate: number = 16000
): Blob => {
  const buffer = new ArrayBuffer(44 + audioData.length * 2);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + audioData.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, audioData.length * 2, true);

  // Convert float samples to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < audioData.length; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
};

// transcribe audio using OpenAI API
export const transcribeAudio = async (
  audioData: Float32Array,
  apiKey: string
): Promise<string> => {
  try {
    // Convert Float32Array to WAV blob
    const wavBlob = floatArrayToWav(audioData);

    // Create form data
    const formData = new FormData();
    formData.append("file", wavBlob, "audio.wav");
    formData.append("model", "whisper-1");
    formData.append("response_format", "text");

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Transcription API Error: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    const transcription = await response.text();
    return transcription.trim();
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
};

// stream completion from API
export const streamCompletion = async (
  provider: any,
  model: string,
  apiKey: string,
  payload: any,
  onChunk: (chunk: string) => void,
  onError: (error: string) => void,
  abortController: AbortController
) => {
  try {
    let url = `${provider.baseUrl}${provider.chatEndpoint}`;

    // handle gemini model interpolation
    if (provider.id === "gemini") {
      url = url.replace("${model}", model);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // handle authentication
    if (provider.authType === "bearer") {
      headers["Authorization"] = `Bearer ${apiKey}`;
    } else if (provider.authType === "x-api-key") {
      headers["x-api-key"] = apiKey;
    } else if (provider.authType === "x-goog-api-key") {
      headers["x-goog-api-key"] = apiKey;
    } else if (
      provider.authType === "custom-header" &&
      provider.customHeaderName
    ) {
      headers[provider.customHeaderName] = apiKey;
    } else if (provider.authType === "query" && provider.authParam) {
      url += `?${provider.authParam}=${apiKey}`;
    }

    if (provider.id === "claude") {
      headers["anthropic-dangerous-direct-browser-access"] = "true";
      headers["anthropic-version"] = "2023-06-01";
    }

    // prepare request body
    const requestBody = {
      model,
      ...payload,
    };

    // special handling for claude
    if (provider.id === "claude") {
      requestBody.max_tokens = 4096;

      // extract system message from messages array and set it directly
      if (requestBody.messages && Array.isArray(requestBody.messages)) {
        const systemMessageIndex = requestBody.messages.findIndex(
          (msg: any) => msg.role === "system"
        );

        if (systemMessageIndex !== -1) {
          const systemMessage = requestBody.messages[systemMessageIndex];
          requestBody.system = systemMessage.content;
          // remove system message from messages array
          requestBody.messages.splice(systemMessageIndex, 1);
        }
      }
    }

    // Only enable streaming for providers that support it
    if (
      provider.id !== "gemini" &&
      (!provider.isCustom || provider.supportsStreaming)
    ) {
      requestBody.stream = true;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: abortController.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API Error: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    // Handle non-streaming custom providers
    if (provider.isCustom && !provider.supportsStreaming) {
      const responseData = await response.json();
      const content =
        getNestedValue(responseData, provider.response.contentPath) || "";
      if (content) {
        onChunk(content);
      }
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body reader available");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim() === "") continue;
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            let content = "";

            // extract content based on provider
            if (provider.id === "openai" || provider.id === "grok") {
              content = parsed.choices?.[0]?.delta?.content || "";
            } else if (provider.id === "claude") {
              if (parsed.type === "content_block_delta") {
                content = parsed.delta?.text || "";
              }
            } else if (provider.id === "gemini") {
              content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
            } else if (provider.isCustom) {
              // Handle custom providers
              if (provider.supportsStreaming) {
                // For streaming, try to extract delta content first, then fall back to full content
                const deltaPath = provider.response.contentPath.replace(
                  "message.content",
                  "delta.content"
                );
                content =
                  getNestedValue(parsed, deltaPath) ||
                  getNestedValue(parsed, provider.response.contentPath) ||
                  "";
              } else {
                // For non-streaming custom providers, extract full content
                content =
                  getNestedValue(parsed, provider.response.contentPath) || "";
              }
            }

            if (content) {
              onChunk(content);
            }
          } catch (e) {
            console.warn("Failed to parse streaming chunk:", e);
          }
        }
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      return; // user cancelled, don't show error
    }
    onError(error instanceof Error ? error.message : "An error occurred");
  }
};
