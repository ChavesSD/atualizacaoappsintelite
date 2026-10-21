import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Verificação de saúde (balanceador/monitor): responde 200 se o banco responde. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
