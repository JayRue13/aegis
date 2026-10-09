import { z } from "zod";
import { checkAccess, rateLimit } from "@/lib/server/access";
import { streamCompletion } from "@/lib/server/gateway";
import { dedupeFacts, LEARN_PROMPT, parseFacts, worthLearning } from "@/lib/learn";

export const maxDuration = 30;

const schema = z.object({
  model: z.string().min(3).max(200),
  userText: z.string().max(8000),
  assistantText: z.string().max(8000),
  existing: z.array(z.string().max(1000)).max(500).default([]),
});

/** Suggests new long-term memories from one exchange. Returns { facts: string[] }. */
export async function POST(req: Request) {
  const access = await checkAccess(req);
  if (!access.ok) return Response.json({ error: access.message }, { status: access.status });
  if (!rateLimit(`learn:${access.identity}`, 10)) return Response.json({ facts: [] });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const { model, userText, assistantText, existing } = parsed.data;
  if (model.startsWith("demo:") || !worthLearning(userText)) return Response.json({ facts: [] });

  let reply = "";
  try {
    for await (const t of streamCompletion({
      modelId: model,
      temperature: 0,
      messages: [
        { role: "system", content: LEARN_PROMPT },
        {
          role: "user",
          content: `EXISTING:\n${
            existing
              .slice(0, 100)
              .map((e) => `- ${e}`)
              .join("\n") || "(none)"
          }\n\nUSER said:\n${userText}\n\nASSISTANT replied:\n${assistantText.slice(0, 2000)}`,
        },
      ],
      signal: AbortSignal.timeout(20_000),
    })) {
      reply += t;
      if (reply.length > 4000) break;
    }
  } catch {
    return Response.json({ facts: [] });
  }
  return Response.json({ facts: dedupeFacts(parseFacts(reply), existing) });
}
