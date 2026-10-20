import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { readJson, route } from "@/lib/http";
import { createCampaign } from "@/lib/services/admin";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  return db.campaign.findMany({ orderBy: { startsAt: "desc" }, include: { _count: { select: { units: true } } } });
});

const schema = z.object({
  name: z.string().trim().min(3).max(200),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional(),
  requireTechnicalValidation: z.boolean().optional(),
});

export const POST = route(async (req) => {
  const admin = await requireAdmin("ADMIN");
  return createCampaign(admin.id, schema.parse(await readJson(req)));
});
