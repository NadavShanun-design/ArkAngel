import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

async function openWindow(label: string, query: string, title: string) {
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.setFocus();
    return existing;
  }

  const win = new WebviewWindow(label, {
    url: `/?${query}`,
    title,
    width: 980,
    height: 720,
    resizable: true,
    decorations: true,
  });

  return win;
}

export async function openFullChatHistoryWindow() {
  return openWindow("full-chat-history", "view=full-history", "All Conversations");
}

export async function openIntegrationsWindow() {
  return openWindow("integrations", "view=integrations", "Integrations");
}
