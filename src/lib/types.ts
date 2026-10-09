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
  | { type: "error"; message: string }
  | { type: "done" };
