// Shared types used by both the browser app and the server routes.

export type Role = "system" | "user" | "assistant";

export interface ImagePart {
  type: "image";
  /** data: URL (base64) of the image, or a short-lived signed https URL for stored images. */
  dataUrl: string;
  /** Path in the Supabase "attachments" bucket when the image is stored in the cloud. */
  path?: string;
  name?: string;
}

export interface FileContext {
  name: string;
  /** Plain-text content of an attached text file. */
  text: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  images?: ImagePart[];
  files?: FileContext[];
  /** Model id that produced an assistant message, e.g. "openrouter:meta-llama/...". */
  model?: string;
  createdAt: string;
  error?: boolean;
  /** Web pages read for this reply. */
  sources?: SourceRef[];
  /** Tools the agent used while answering. */
  steps?: AgentStep[];
  /** Changes the agent proposed, awaiting or after the user's decision. */
  actions?: AgentAction[];
}

export interface AgentStep {
  tool: string;
  label: string;
  ok: boolean;
  links?: { url: string; title?: string }[];
}

export interface AgentAction {
  id: string;
  kind: "save_memory" | "create_workspace";
  summary: string;
  payload: Record<string, string>;
  status: "pending" | "approved" | "dismissed";
}

export interface SourceRef {
  url: string;
  title?: string;
  ok: boolean;
  error?: string;
}

export interface Conversation {
  id: string;
  title: string;
  projectId: string | null;
  model: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  instructions: string;
  createdAt: string;
}

export interface Memory {
  id: string;
  content: string;
  createdAt: string;
}

export interface ModelInfo {
  /** Fully-qualified id: "<provider>:<model>". */
  id: string;
  provider: string;
  label: string;
  vision?: boolean;
}

/** Events streamed from /api/chat as newline-delimited JSON. */
export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "sources"; sources: SourceRef[] }
  | { type: "step"; step: AgentStep }
  | { type: "action"; action: AgentAction }
  | { type: "error"; message: string }
  | { type: "done" };
