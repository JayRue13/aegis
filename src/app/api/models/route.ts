import { checkAccess } from "@/lib/server/access";
import { DEMO_MODEL, demoEnabled, getProviders, listModels } from "@/lib/server/providers";
import type { ModelInfo } from "@/lib/types";

export async function GET(req: Request) {
  const access = await checkAccess(req);
  if (!access.ok) return Response.json({ error: access.message, models: [] }, { status: access.status });

  const providers = getProviders();
  const lists = await Promise.all(providers.map((p) => listModels(p)));
  const models: ModelInfo[] = lists.flat();
  if (demoEnabled()) models.push(DEMO_MODEL);

  const preferred = process.env.AEGIS_DEFAULT_MODEL;
  const defaultModel = models.find((m) => m.id === preferred)?.id ?? models[0]?.id ?? null;

  return Response.json(
    { models, defaultModel, providers: providers.map((p) => ({ id: p.id, label: p.label })) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
