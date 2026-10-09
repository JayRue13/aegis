import type { ChatMessage, Conversation } from "./types";

/** Renders a conversation as a portable Markdown document. */
export function conversationToMarkdown(conv: Conversation, messages: ChatMessage[]): string {
  const lines = [`# ${conv.title}`, "", `_Exported from AEGIS on ${new Date().toISOString().slice(0, 10)}_`, ""];
  for (const m of messages) {
    if (m.role === "system") continue;
    const who = m.role === "user" ? "You" : `AEGIS${m.model ? ` (${m.model.split(":").slice(1).join(":")})` : ""}`;
    lines.push(`## ${who}`, "");
    const attachments = [...(m.files ?? []).map((f) => f.name), ...(m.images ?? []).map((i) => i.name ?? "image")];
    if (attachments.length) lines.push(`_Attachments: ${attachments.join(", ")}_`, "");
    lines.push(m.content.trim(), "");
  }
  return lines.join("\n");
}

export function safeFilename(title: string): string {
  return (
    title
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60)
      .toLowerCase() || "chat"
  );
}
