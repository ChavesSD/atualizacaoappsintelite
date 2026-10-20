import { requireClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { route } from "@/lib/http";
import { getApplicableProcedures, getCriteria, getPublishedStep } from "@/lib/services/content";
import { getOrCreateSession } from "@/lib/services/session";

export const dynamic = "force-dynamic";

/** Conteúdo publicado + (nas etapas de enquadramento) critérios e procedimentos oficiais aplicáveis. */
export const GET = route<{ params: Promise<{ key: string }> }>(async (_req, { params }) => {
  const cu = await requireClient();
  const key = (await params).key;
  const published = await getPublishedStep(key);
  let framing = null;
  if (published.step.kind === "ENQUADRAMENTO" && published.step.type) {
    const s = await getOrCreateSession(cu.id);
    const check = await db.framingCheck.findFirst({ where: { sessionId: s.id, type: published.step.type }, include: { equipment: true, issues: true } });
    const modelId = check?.equipment.modelId ?? null;
    const open = check?.issues.filter((i) => !i.resolvedAt).map((i) => i.type) ?? [];
    framing = {
      criteria: await getCriteria(published.step.type, modelId),
      procedures: await getApplicableProcedures(published.step.type, modelId, open),
    };
  }
  return { ...published, framing };
});
