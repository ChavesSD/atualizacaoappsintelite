import crypto from "node:crypto";
import type { Framing, Photo, Submission } from "@prisma/client";
import { db } from "./db";
import { badRequest, conflict, notFound } from "./http";
import { storage } from "./storage";
import { DEFAULT_SOLUTION, STEPS, isSolution } from "./flow";

// ───────── regras de navegação ─────────

/** Fotos que a equipe mandou refazer e que o cliente ainda não substituiu (nenhuma foto aceitável enviada depois). */
export function pendingRedo(photos: Photo[]): Photo[] {
  return photos.filter((p) => p.review === "REFAZER" && !photos.some((q) => q.review !== "REFAZER" && q.createdAt.getTime() > p.createdAt.getTime()));
}
/** Falta foto se não há nenhuma ou se alguma pedida de novo ainda não foi refeita. */
export const photoOk = (photos: Photo[]) => photos.length > 0 && pendingRedo(photos).length === 0;

const framingDone = (f: Framing) => f === "CORRETO" || f === "PRECISA_SUPORTE";

/** Fases já concluídas (índices de STEPS). A última só conta depois do envio. */
export function doneSteps(s: Submission, photos: Photo[]): boolean[] {
  return [s.installed, framingDone(s.framing), photoOk(photos), s.status !== "EM_ANDAMENTO"];
}

/** Fases que o cliente já pode abrir: cada uma exige a anterior concluída. Impede pular verificações obrigatórias. */
export function unlockedSteps(s: Submission, photos: Photo[]): boolean[] {
  const d = doneSteps(s, photos);
  return [true, d[0], d[0] && d[1], d[0] && d[1] && d[2]];
}

async function log(submissionId: string, actor: "CLIENTE" | "EQUIPE", text: string) {
  await db.activity.create({ data: { submissionId, actor, text } });
}

// ───────── cliente ─────────

export interface NewSubmission { company: string; contactName: string; solution?: string }

export async function createSubmission(d: NewSubmission) {
  const solution = d.solution && isSolution(d.solution) ? d.solution : DEFAULT_SOLUTION;
  const s = await db.submission.create({ data: { company: d.company, contactName: d.contactName, solution, step: 0 } });
  await log(s.id, "CLIENTE", `Iniciou a atualização (${d.contactName}, ${d.company}).`);
  return s;
}

export async function loadView(id: string) {
  const s = await db.submission.findUnique({ where: { id }, include: { photos: { orderBy: { createdAt: "asc" } } } });
  if (!s) throw notFound("Envio não encontrado.");
  const { photos, ...submission } = s;
  return {
    submission,
    photos: photos.map((p) => ({ id: p.id, review: p.review, reviewNote: p.review === "REFAZER" ? p.reviewNote : null, createdAt: p.createdAt })),
    done: doneSteps(s, photos),
    unlocked: unlockedSteps(s, photos),
    redo: pendingRedo(photos).length > 0,
  };
}

export interface Patch {
  step?: number;
  installed?: boolean;
  framing?: { outcome: "CORRETO" | "INCORRETO" | "PRECISA_SUPORTE"; issues: string[]; notes?: string };
  help?: { message?: string; step: string };
}

export async function patchSubmission(id: string, p: Patch) {
  const cur = await db.submission.findUnique({ where: { id }, include: { photos: true } });
  if (!cur) throw notFound();
  const data: Record<string, unknown> = {};
  const notes: string[] = [];

  if (p.installed !== undefined && p.installed !== cur.installed) {
    data.installed = p.installed;
    notes.push(p.installed ? "Marcou a atualização do aplicativo como feita." : "Desmarcou a atualização do aplicativo.");
  }
  if (p.framing) {
    const { outcome, issues, notes: n } = p.framing;
    if (outcome === "CORRETO" && issues.length) throw badRequest("Não informe problemas ao declarar a tela correta.");
    data.framing = outcome;
    data.framingIssues = outcome === "CORRETO" ? [] : issues;
    data.framingNotes = n?.slice(0, 1000) || null;
    data.confirmed = false; // nova verificação do cliente invalida a confirmação anterior da equipe
    notes.push(`Tela: ${outcome === "CORRETO" ? "declarou correta" : outcome === "INCORRETO" ? `informou que a tela não está correta${issues.length ? ` (${issues.join(", ")})` : ""}` : "pediu suporte"}.`);
  }
  if (p.help) {
    data.helpRequested = true;
    data.helpResolved = false; // novo pedido reabre o atendimento
    data.helpMessage = p.help.message?.slice(0, 1000) || null;
    data.helpStep = p.help.step;
    notes.push(`Pediu ajuda na etapa “${p.help.step}”${p.help.message ? `: ${p.help.message.slice(0, 200)}` : "."}`);
  }
  if (p.step !== undefined) {
    const merged = { ...cur, ...data } as Submission;
    if (p.step < 0 || p.step >= STEPS.length) throw badRequest("Etapa inválida.");
    if (!unlockedSteps(merged, cur.photos)[p.step]) throw conflict("Conclua a etapa anterior antes de avançar.");
    data.step = p.step;
  }
  if (Object.keys(data).length) await db.submission.update({ where: { id }, data });
  for (const t of notes) await log(id, "CLIENTE", t);
  return loadView(id);
}

export async function addPhoto(id: string, bytes: Buffer, mime: string, ext: string) {
  const cur = await db.submission.findUnique({ where: { id }, include: { photos: true } });
  if (!cur) throw notFound();
  if (cur.photos.length >= 10) throw conflict("Limite de fotos atingido. Fale com o suporte.");
  const key = `photos/${id}/${crypto.randomUUID()}.${ext}`;
  await storage().put(key, bytes);
  try {
    await db.photo.create({ data: { submissionId: id, type: "TELA", storageKey: key, mime, sizeBytes: bytes.length } });
  } catch (e) {
    await storage().remove(key);
    throw e;
  }
  await log(id, "CLIENTE", "Enviou foto da tela.");
  // Se a equipe tinha pedido ajuste e as fotos pendentes foram refeitas, volta para a fila de análise.
  const photos = await db.photo.findMany({ where: { submissionId: id } });
  if (cur.status === "PRECISA_AJUSTE" && photoOk(photos)) {
    await db.submission.update({ where: { id }, data: { status: "ENVIADO" } });
    await log(id, "CLIENTE", "Reenviou as fotos solicitadas.");
  }
  return loadView(id);
}

export async function submitFinal(id: string, d: { rating: number; comment?: string; hardestStep?: string }) {
  const cur = await db.submission.findUnique({ where: { id }, include: { photos: true } });
  if (!cur) throw notFound();
  if (!unlockedSteps(cur, cur.photos)[STEPS.length - 1]) throw conflict("Ainda há etapas pendentes antes do envio.");
  await db.submission.update({
    where: { id },
    data: {
      rating: d.rating, comment: d.comment?.slice(0, 2000) || null, hardestStep: d.hardestStep || null, step: STEPS.length - 1,
      ...(cur.status === "EM_ANDAMENTO" ? { status: "ENVIADO", submittedAt: new Date() } : {}),
    },
  });
  await log(id, "CLIENTE", `Enviou a confirmação final (nota ${d.rating}/5).`);
  return loadView(id);
}

export async function photoFile(id: string) {
  const p = await db.photo.findUnique({ where: { id } });
  if (!p) throw notFound();
  const data = await storage().get(p.storageKey);
  if (!data) throw notFound("Arquivo não encontrado.");
  return { data, mime: p.mime, submissionId: p.submissionId };
}

// ───────── equipe ─────────

export async function reviewPhoto(photoId: string, review: "APROVADA" | "REFAZER", note?: string) {
  if (review === "REFAZER" && (!note || note.trim().length < 5)) throw badRequest("Explique ao cliente por que a nova foto é necessária.");
  const p = await db.photo.update({ where: { id: photoId }, data: { review, reviewNote: review === "REFAZER" ? note!.trim() : null } });
  if (review === "REFAZER") {
    await db.submission.update({ where: { id: p.submissionId }, data: { confirmed: false, status: "PRECISA_AJUSTE" } });
  }
  await log(p.submissionId, "EQUIPE", review === "APROVADA" ? "Aprovou uma foto." : `Pediu nova foto: ${note!.trim()}`);
  return p;
}

export async function updateByAdmin(id: string, d: { status?: Submission["status"]; adminNotes?: string; confirmed?: boolean; helpResolved?: boolean }) {
  const cur = await db.submission.findUnique({ where: { id }, include: { photos: true } });
  if (!cur) throw notFound();
  const data: Record<string, unknown> = {};
  if (d.confirmed !== undefined) {
    if (d.confirmed && !cur.photos.some((p) => p.review === "APROVADA")) throw conflict("Aprove uma foto antes de confirmar o enquadramento.");
    data.confirmed = d.confirmed;
    await log(id, "EQUIPE", d.confirmed ? "Confirmou o enquadramento da tela." : "Removeu a confirmação do enquadramento.");
  }
  if (d.status && d.status !== cur.status) {
    const confirmed = (data.confirmed ?? cur.confirmed) as boolean;
    if (d.status === "APROVADO" && !confirmed) throw conflict("Confirme o enquadramento da tela antes de aprovar.");
    if (d.status === "EM_ANDAMENTO") throw badRequest("Status inválido.");
    data.status = d.status;
    await log(id, "EQUIPE", `Alterou o status para ${d.status}.`);
  }
  if (d.helpResolved !== undefined && d.helpResolved !== cur.helpResolved) {
    data.helpResolved = d.helpResolved;
    await log(id, "EQUIPE", d.helpResolved ? "Marcou o pedido de ajuda como atendido." : "Reabriu o pedido de ajuda.");
  }
  if (d.adminNotes !== undefined) data.adminNotes = d.adminNotes.slice(0, 4000);
  await db.submission.update({ where: { id }, data });
}

/** Exclusão definitiva do envio e dos arquivos das fotos (pedido do cliente / LGPD). */
export async function deleteSubmission(id: string) {
  const cur = await db.submission.findUnique({ where: { id }, include: { photos: true } });
  if (!cur) throw notFound();
  for (const p of cur.photos) await storage().remove(p.storageKey);
  await db.submission.delete({ where: { id } });
}
