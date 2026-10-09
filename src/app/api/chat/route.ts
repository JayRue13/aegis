import { checkAccess, rateLimit } from "@/lib/server/access";
import { GatewayError, streamCompletion, toEventStream } from "@/lib/server/gateway";
import { chatRequestSchema } from "@/lib/server/schema";
import { buildSystemPrompt, toProviderMessages } from "@/lib/prompt";
import { selectMemories } from "@/lib/memory";
import type { ChatMessage } from "@/lib/types";

export const maxDuration = 60;

function json(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const access = await checkAccess(req);
  if (!access.ok) return json(access.status, access.message);

  const perMinute = Number(process.env.AEGIS_RATE_LIMIT_PER_MIN ?? 20);
  if (!rateLimit(access.identity, perMinute)) {
    return json(429, "Too many messages in a minute. Take a breath and try again.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, "Request body must be JSON.");
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return json(400, `Invalid request: ${parsed.error.issues[0]?.message ?? "bad input"}`);
  const input = parsed.data;

  const history = input.messages as ChatMessage[];
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  const memories = selectMemories(input.memories ?? [], lastUser?.content ?? "");
  const system = buildSystemPrompt({
    memories,
    projectName: input.project?.name,
    projectInstructions: input.project?.instructions,
    userName: input.userName,
  });

  const gen = streamCompletion({
    modelId: input.model,
    messages: toProviderMessages(history, system),
    temperature: input.temperature,
    signal: req.signal,
  });

  // Surface configuration errors (unknown provider, bad key) as HTTP errors
  // instead of a stream, so the client can show them plainly.
  let first: IteratorResult<string>;
  try {
    first = await gen.next();
  } catch (err) {
    const status = err instanceof GatewayError ? err.status : 500;
    return json(status, (err as Error).message);
  }

  async function* replay(): AsyncGenerator<string> {
    if (!first.done) yield first.value;
    yield* gen;
  }

  return new Response(toEventStream(replay()), {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
