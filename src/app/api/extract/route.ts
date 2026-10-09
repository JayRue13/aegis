import { checkAccess, rateLimit } from "@/lib/server/access";
import { detectKind, extractText, MAX_UPLOAD_BYTES } from "@/lib/server/extract";

export const maxDuration = 30;

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status });
}

/** Accepts one PDF or DOCX file (multipart field "file") and returns its text. */
export async function POST(req: Request) {
  const access = await checkAccess(req);
  if (!access.ok) return json(access.status, { error: access.message });
  if (!rateLimit(`extract:${access.identity}`, 30)) return json(429, { error: "Too many uploads. Try again shortly." });

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES + 64 * 1024) return json(413, { error: "File is larger than 4 MB." });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    return json(400, { error: "Expected a multipart upload." });
  }
  if (!file) return json(400, { error: "No file uploaded." });
  if (file.size > MAX_UPLOAD_BYTES) return json(413, { error: "File is larger than 4 MB." });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectKind(file.name, file.type, bytes.subarray(0, 8));
  if (!kind) return json(415, { error: "Only PDF and Word (.docx) documents can be read." });

  try {
    const { text, pages } = await extractText(kind, bytes);
    if (!text) return json(422, { error: "No readable text found (it may be a scanned image)." });
    return json(200, { name: file.name, text, pages });
  } catch {
    return json(422, { error: "Couldn't read this document. It may be encrypted or damaged." });
  }
}
