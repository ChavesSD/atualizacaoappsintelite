import { notFound, redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { allowedHosts } from "@/lib/services/content";
import { validateVideoUrl } from "@/domain/video-url";
import { StepBody, type StepPayload } from "@/components/StepBody";

export const dynamic = "force-dynamic";

/** Prévia (rascunho ou publicado) exatamente como o cliente verá, para ser aberta em moldura de celular. */
export default async function PreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ format?: string }> }) {
  if (!(await getAdmin())) redirect("/admin/login");
  const { id } = await params;
  const format = (await searchParams).format === "VIDEO" ? "VIDEO" : "TEXTO";
  const c = await db.stepContent.findUnique({ where: { id }, include: { video: true, step: true } });
  if (!c) notFound();
  const hosts = await allowedHosts();
  const v = c.video && validateVideoUrl(c.video.url, hosts);
  const payload: StepPayload = {
    content: { id: c.id, version: c.version, recommendedFormat: c.recommendedFormat, instructions: c.instructions as never, referenceImages: c.referenceImages as never },
    video: c.video && v && v.ok
      ? { title: c.video.title, description: c.video.description, url: v.url, direct: v.direct, thumbnailUrl: c.video.thumbnailUrl, captionsUrl: c.video.captionsUrl, transcript: c.video.transcript }
      : null,
  };
  return (
    <main className="container">
      <p className="muted small">Prévia · versão {c.version} ({c.status.toLowerCase()})</p>
      <h1>{c.step.title}</h1>
      {format === "VIDEO" && c.hasVideo && !payload.video && <div className="alert bad small">O vídeo cadastrado não é válido ou seu domínio não está autorizado: o cliente verá apenas o texto.</div>}
      <div className="card"><StepBody data={payload} format={format} /></div>
    </main>
  );
}
