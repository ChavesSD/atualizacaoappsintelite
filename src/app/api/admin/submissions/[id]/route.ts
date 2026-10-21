import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, readJson, route } from "@/lib/http";
import { deleteSubmission, updateByAdmin } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  await requireAdmin();
  const s = await db.submission.findUnique({ where: { id: (await params).id }, include: { photos: { orderBy: { createdAt: "asc" } }, activities: { orderBy: { at: "desc" } } } });
  if (!s) throw notFound();
  return s;
});

const patch = z.object({
  status: z.enum(["ENVIADO", "APROVADO", "PRECISA_AJUSTE"]).optional(),
  adminNotes: z.string().max(4000).optional(),
  totemConfirmed: z.boolean().optional(),
  painelConfirmed: z.boolean().optional(),
  helpResolved: z.boolean().optional(),
});

export const PATCH = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  await requireAdmin();
  const id = (await params).id;
  await updateByAdmin(id, patch.parse(await readJson(req)));
  return { ok: true };
});

export const DELETE = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  await requireAdmin();
  await deleteSubmission((await params).id);
  return { ok: true };
});
