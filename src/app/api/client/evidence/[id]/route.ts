import { requireClient } from "@/lib/auth";
import { route } from "@/lib/http";
import { getEvidenceFile } from "@/lib/services/session";

export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const cu = await requireClient();
  const { data, mime } = await getEvidenceFile((await params).id, { campaignUnitId: cu.id });
  return new Response(new Uint8Array(data), { headers: { "Content-Type": mime, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" } });
});
