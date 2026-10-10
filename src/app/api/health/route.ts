import { connection } from "next/server";
import { authMode } from "@/lib/server/access";
import { demoEnabled, getProviders } from "@/lib/server/providers";

// Public, secret-free status for uptime checks and the Settings screen.
export async function GET() {
  await connection();
  return Response.json(
    {
      status: "ok",
      version: process.env.npm_package_version ?? "0.6.0",
      auth: authMode(),
      providers: getProviders().map((p) => p.id),
      demo: demoEnabled(),
      dailyLimit: Number(process.env.AEGIS_DAILY_MESSAGE_LIMIT ?? 0) || 0,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
