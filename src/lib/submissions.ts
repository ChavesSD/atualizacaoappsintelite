import crypto from "node:crypto";
import type { Format, Framing, PhotoType, Photo, Submission } from "@prisma/client";
import { db } from "./db";
import { badRequest, conflict, notFound } from "./http";
import { storage } from "./storage";
import { STEPS } from "./flow";

// ───────── regras de navegação ─────────

/** A foto mais recente de cada equipamento é a que vale; se ela foi marcada para refazer, falta foto. */
export function latestPhoto(photos: Photo[], type: PhotoType): Photo | undefined {
  return photos.filter((p) => p.type === type).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}
export const photoOk = (photos: Photo[], type: PhotoType) => {
  const p = latestPhoto(photos, type);
  return !!p && p.review !== "REFAZER";
};
const framingDone = (f: Framing) => f === "CORRETO" || f === "PRECISA_SUPORTE";

/** Maior etapa na ordem padrão (totem antes do painel). Mantida para os indicadores; a navegação usa `unlockedSteps`. */
export function maxStep(s: Submission, photos: Photo[]): number {
  if (!s.format) return 1;
  if (!s.totemUpdated) return 2;
  if (!framingDone(s.totemFraming)) return 3;
  if (!s.painelUpdated) return 4;
  if (!framingDone(s.painelFraming)) return 5;
  if (!photoOk(photos, "TOTEM") || !photoOk(photos, "PAINEL")) return 6;
  return STEPS.length - 1;
}

/** Etapas já concluídas (índices de STEPS). A última só conta depois do envio. */
export function doneSteps(s: Submission, photos: Photo[]): boolean[] {
  return [
    true,
    !!s.format,
    s.totemUpdated,
    framingDone(s.totemFraming),
    s.painelUpdated,
    framingDone(s.painelFraming),
    photoOk(photos, "TOTEM") && photoOk(photos, "PAINEL"),
    s.status !== "EM_ANDAMENTO",
  ];
}

/**
 * Etapas que o cliente já pode abrir. Totem e painel são independentes: depois do formato, ele escolhe por qual começar.
 * Dentro de cada equipamento a conferência da tela só abre depois da atualização; fotos e envio exigem os dois.
 */
export function unlockedSteps(s: Submission, photos: Photo[]): boolean[] {
  const d = doneSteps(s, photos);
  const fmt = d[1];
  const equipamentos = d[3] && d[5];
  return [true, true, fmt, fmt && d[2], fmt, fmt && d[4], equipamentos, equipamentos && d[6]];
}

async function log(submissionId: string, actor: "CLIENTE" | "EQUIPE", text: string) {
  await db.activity.create({ data: { submissionId, actor, text } });
}

// ───────── cliente ─────────

export interface NewSubmission { company: string; contactName: string }

export async function createSubmission(d: NewSubmission) {
  const s = await db.submission.create({ data: { ...d, step: 1 } });
  await log(s.id, "CLIENTE", `Iniciou o tutorial (${d.contactName}, ${d.company}).`);
  return s;
}

export async function loadView(id: string) {
  const s = await db.submission.findUnique({ where: { id }, include: { photos: { orderBy: { createdAt: "asc" } } } });
  if (!s) throw notFound("Envio não encontrado.");
  const { photos, ...submission } = s;
  return {
    submission,
    photos: photos.map((p) => ({ id: p.id, type: p.type, review: p.review, reviewNote: p.review === "REFAZER" ? p.reviewNote : null, createdAt: p.createdAt })),
    maxStep: maxStep(s, photos),
    done: doneSteps(s, photos),
    unlocked: unlockedSteps(s, photos),
    redo: (["TOTEM", "PAINEL"] as const).filter((t) => latestPhoto(photos, t)?.review === "REFAZER"),
  };
}

export interface Patch {
  step?: number;
  format?: Format;
  totemUpdated?: boolean;
  painelUpdated?: boolean;
  framing?: { type: PhotoType; outcome: "CORRETO" | "INCORRETO" | "PRECISA_SUPORTE"; issues: string[]; notes?: string };
  help?: { message?: string; step: string };
}

export async function patchSubmission(id: string, p: Patch) {
  const cur = await db.submission.findUnique({ where: { id }, include: { photos: true } });
  if (!cur) throw notFound();
  const data: Record<string, unknown> = {};
  const notes: string[] = [];

  if (p.format && p.format !== cur.format) {
    data.format = p.format;
    if (!cur.initialFormat) data.initialFormat = p.format;
    else data.formatChanges = cur.formatChanges + 1;
    notes.push(cur.format ? `Trocou o formato para ${p.format === "VIDEO" ? "vídeo" : "texto"}.` : `Escolheu o tutorial em ${p.format === "VIDEO" ? "vídeo" : "texto"}.`);
  }
  if (p.totemUpdated !== undefined) { data.totemUpdated = p.totemUpdated; if (p.totemUpdated) notes.push("Marcou a atualização do totem como feita."); }
  if (p.painelUpdated !== undefined) { data.painelUpdated = p.painelUpdated; if (p.painelUpdated) notes.push("Marcou a atualização do painel como feita."); }

  if (p.framing) {
    const { type, outcome, issues, notes: n } = p.framing;
    if (outcome === "CORRETO" && issues.length) throw badRequest("Não informe problemas ao declarar a tela correta.");
    const k = type === "TOTEM" ? "totem" : "painel";
    data[`${k}Framing`] = outcome;
    data[`${k}Issues`] = outcome === "CORRETO" ? [] : issues;
    data[`${k}Notes`] = n?.slice(0, 1000) || null;
    data[`${k}Confirmed`] = false; // nova verificação do cliente invalida a confirmação anterior da equipe
    notes.push(`Tela do ${k}: ${outcome === "CORRETO" ? "declarou correta" : outcome === "INCORRETO" ? `informou que a tela não está correta${issues.length ? ` (${issues.join(", ")})` : ""}` : "pediu suporte"}.`);
  }
  if (p.help) {
    data.helpRequested = true;
    data.helpResolved = false; // novo pedido reabre o atendimento
    data.helpMessage = p.help.message?.slice(0, 1000) || null;
    data.helpStep = p.help.step;
    data.helpFormat = p.format ?? cur.format;
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

export async function addPhoto(id: string, type: PhotoType, bytes: Buffer, mime: string, ext: string) {
  const cur = await db.submission.findUnique({ where: { id }, include: { photos: true } });
  if (!cur) throw notFound();
  if (cur.photos.filter((p) => p.type === type).length >= 10) throw conflict("Limite de fotos atingido. Fale com o suporte.");
  const key = `photos/${id}/${crypto.randomUUID()}.${ext}`;
  await storage().put(key, bytes);
  try {
    await db.photo.create({ data: { submissionId: id, type, storageKey: key, mime, sizeBytes: bytes.length } });
  } catch (e) {
    await storage().remove(key);
    throw e;
  }
  await log(id, "CLIENTE", `Enviou foto do ${type === "TOTEM" ? "totem" : "painel"}.`);
  // Se a equipe tinha pedido ajuste e as fotos pendentes foram refeitas, volta para a fila de análise.
  const photos = await db.photo.findMany({ where: { submissionId: id } });
  if (cur.status === "PRECISA_AJUSTE" && photoOk(photos, "TOTEM") && photoOk(photos, "PAINEL")) {
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
  const k = p.type === "TOTEM" ? "totem" : "painel";
  if (review === "REFAZER") {
    await db.submission.update({ where: { id: p.submissionId }, data: { [`${k}Confirmed`]: false, status: "PRECISA_AJUSTE" } });
  }
  await log(p.submissionId, "EQUIPE", review === "APROVADA" ? `Aprovou a foto do ${k}.` : `Pediu nova foto do ${k}: ${note!.trim()}`);
  return p;
}

export async function updateByAdmin(id: string, d: { status?: Submission["status"]; adminNotes?: string; totemConfirmed?: boolean; painelConfirmed?: boolean; helpResolved?: boolean }) {
  const cur = await db.submission.findUnique({ where: { id }, include: { photos: true } });
  if (!cur) throw notFound();
  const data: Record<string, unknown> = {};
  for (const t of ["TOTEM", "PAINEL"] as const) {
    const k = t === "TOTEM" ? "totem" : "painel";
    const v = d[`${k}Confirmed` as "totemConfirmed" | "painelConfirmed"];
    if (v === undefined) continue;
    if (v && latestPhoto(cur.photos, t)?.review !== "APROVADA") throw conflict(`Aprove a foto do ${k} antes de confirmar o enquadramento.`);
    data[`${k}Confirmed`] = v;
    await log(id, "EQUIPE", v ? `Confirmou o enquadramento do ${k}.` : `Removeu a confirmação do ${k}.`);
  }
  if (d.status && d.status !== cur.status) {
    const t = (data.totemConfirmed ?? cur.totemConfirmed) as boolean, pn = (data.painelConfirmed ?? cur.painelConfirmed) as boolean;
    if (d.status === "APROVADO" && !(t && pn)) throw conflict("Confirme o enquadramento do totem e do painel antes de aprovar.");
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
