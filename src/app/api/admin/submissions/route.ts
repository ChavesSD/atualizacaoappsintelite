import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { route } from "@/lib/http";
import { computeStats } from "@/lib/stats";
import { latestPhoto } from "@/lib/submissions";

export const dynamic = "force-dynamic";

/** Lista de envios + indicadores calculados dos registros reais. Filtros: status, formato, busca, período. */
export const GET = route(async (req) => {
  await requireAdmin();
  const q = new URL(req.url).searchParams;
  const from = q.get("from") && /^\d{4}-\d{2}-\d{2}$/.test(q.get("from")!) ? new Date(`${q.get("from")}T00:00:00Z`) : undefined;
  const to = q.get("to") && /^\d{4}-\d{2}-\d{2}$/.test(q.get("to")!) ? new Date(`${q.get("to")}T23:59:59.999Z`) : undefined;
  const status = q.get("status");
  const format = q.get("format");
  const search = q.get("q")?.trim();
  const rows = await db.submission.findMany({
    where: {
      ...(status && { status: status as never }),
      ...(format && { initialFormat: format as never }),
      ...((from || to) && { createdAt: { gte: from, lte: to } }),
      ...(search && { OR: [{ company: { contains: search, mode: "insensitive" } }, { contactName: { contains: search, mode: "insensitive" } }] }),
    },
    orderBy: { updatedAt: "desc" },
    include: { photos: true },
    take: 500,
  });
  const items = rows.map(({ photos, ...s }) => ({ ...s, pendingPhotos: (["TOTEM", "PAINEL"] as const).filter((t) => latestPhoto(photos, t)?.review === "PENDENTE").length, photoCount: photos.length }));
  return { items, stats: computeStats(items) };
});
