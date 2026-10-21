import { getAdmin, getSubmissionId } from "@/lib/auth";
import { forbidden, route } from "@/lib/http";
import { photoFile } from "@/lib/submissions";

/** Foto: somente o próprio cliente (cookie do envio) ou a equipe logada. */
export const GET = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const f = await photoFile((await params).id);
  if (!(await getAdmin()) && (await getSubmissionId()) !== f.submissionId) throw forbidden();
  return new Response(new Uint8Array(f.data), { headers: { "Content-Type": f.mime, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" } });
});
