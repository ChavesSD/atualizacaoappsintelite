import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { readJson, route } from "@/lib/http";
import { reviewPhoto } from "@/lib/submissions";

const schema = z.object({ review: z.enum(["APROVADA", "REFAZER"]), note: z.string().max(1000).optional() });

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  await requireAdmin();
  const b = schema.parse(await readJson(req));
  await reviewPhoto((await params).id, b.review, b.note);
  return { ok: true };
});
