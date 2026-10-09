// Extracts plain text from uploaded documents so they can be used as chat context.

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel functions accept ~4.5 MB bodies
export const MAX_EXTRACTED_CHARS = 400_000;

export type DocKind = "pdf" | "docx";

export function detectKind(name: string, type: string, head: Uint8Array): DocKind | null {
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46; // %PDF
  if (isPdf && (type === "application/pdf" || /\.pdf$/i.test(name) || !type)) return "pdf";
  if (isZip && (/wordprocessingml/.test(type) || /\.docx$/i.test(name))) return "docx";
  return null;
}

export async function extractText(kind: DocKind, bytes: Uint8Array): Promise<{ text: string; pages?: number }> {
  if (kind === "pdf") {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { totalPages, text } = await pdfText(pdf, { mergePages: false });
    const joined = (text as string[]).map((t, i) => `--- Page ${i + 1} ---\n${t.trim()}`).join("\n\n");
    return { text: clean(joined), pages: totalPages };
  }
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return { text: clean(value) };
}

function clean(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_EXTRACTED_CHARS);
}
