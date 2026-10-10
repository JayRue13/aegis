// Workspace knowledge: picks the parts of a workspace's files that matter for
// the current message. Keyword ranking (BM25) keeps it free and instant; an
// embedding index can replace `selectKnowledge` later without changing callers.

import { stem, tokenize } from "./memory";
import type { KnowledgeFile, KnowledgeSnippet } from "./types";

/** Splits text into overlapping chunks, preferring paragraph and sentence breaks. */
export function chunkText(text: string, size = 1200, overlap = 200): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= size) return clean ? [clean] : [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const window = clean.slice(start, end);
      const breakAt = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf(". "), window.lastIndexOf("\n"));
      if (breakAt > size * 0.5) end = start + breakAt + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.filter(Boolean);
}

interface Chunk {
  name: string;
  text: string;
  terms: string[];
}

/**
 * Chooses excerpts to send with a message. Small workspaces are sent whole;
 * larger ones send the best-matching chunks by BM25 score.
 */
export function selectKnowledge(
  files: Pick<KnowledgeFile, "name" | "text">[],
  query: string,
  { maxChunks = 5, maxChars = 8000 } = {},
): KnowledgeSnippet[] {
  const total = files.reduce((n, f) => n + f.text.length, 0);
  if (total === 0) return [];
  if (total <= maxChars) return files.filter((f) => f.text.trim()).map((f) => ({ name: f.name, text: f.text.trim() }));

  const chunks: Chunk[] = files.flatMap((f) =>
    chunkText(f.text).map((text) => ({ name: f.name, text, terms: tokenize(text).map(stem) })),
  );
  const q = [...new Set(tokenize(query).map(stem))];
  if (q.length === 0 || chunks.length === 0) return [];

  const avgLen = chunks.reduce((n, c) => n + c.terms.length, 0) / chunks.length || 1;
  const df = new Map<string, number>();
  for (const c of chunks) for (const t of new Set(c.terms)) df.set(t, (df.get(t) ?? 0) + 1);
  const k1 = 1.2;
  const b = 0.75;

  const scored = chunks
    .map((c, i) => {
      const tf = new Map<string, number>();
      for (const t of c.terms) tf.set(t, (tf.get(t) ?? 0) + 1);
      let score = 0;
      for (const t of q) {
        const f = tf.get(t);
        if (!f) continue;
        const n = df.get(t) ?? 0;
        const idf = Math.log(1 + (chunks.length - n + 0.5) / (n + 0.5));
        score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * c.terms.length) / avgLen));
      }
      return { c, i, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b2) => b2.score - a.score || a.i - b2.i);

  const out: KnowledgeSnippet[] = [];
  let used = 0;
  for (const { c } of scored) {
    if (out.length >= maxChunks || used + c.text.length > maxChars) break;
    out.push({ name: c.name, text: c.text });
    used += c.text.length;
  }
  return out;
}
