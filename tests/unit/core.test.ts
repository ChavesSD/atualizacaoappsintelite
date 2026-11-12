import { describe, expect, it } from "vitest";
import type { Photo, Submission } from "@prisma/client";
import { resolveVideo, parseHosts, DEFAULT_VIDEO_HOSTS } from "@/lib/video";
import { computeStats, medianMinutes, type StatRow } from "@/lib/stats";
import { doneSteps, pendingRedo, photoOk, unlockedSteps } from "@/lib/submissions";
import { sniffImage } from "@/lib/upload";
import { parseRange, sanitizeLinks } from "@/lib/downloads";
import { checkEnv } from "@/lib/preflight";

describe("vídeo", () => {
  const hosts = ["videos.intelite.com.br", ...DEFAULT_VIDEO_HOSTS];
  it("converte YouTube e Vimeo em incorporação", () => {
    expect(resolveVideo("https://www.youtube.com/watch?v=abcDEF12345", hosts)).toEqual({ ok: true, kind: "embed", src: "https://www.youtube-nocookie.com/embed/abcDEF12345" });
    expect(resolveVideo("https://youtu.be/abcDEF12345", hosts)).toMatchObject({ ok: true, src: "https://www.youtube-nocookie.com/embed/abcDEF12345" });
    expect(resolveVideo("https://vimeo.com/123456", hosts)).toMatchObject({ ok: true, src: "https://player.vimeo.com/video/123456" });
  });
  it("aceita arquivo direto de domínio autorizado", () => {
    expect(resolveVideo("https://videos.intelite.com.br/totem.mp4", hosts)).toMatchObject({ ok: true, kind: "file" });
  });
  it.each([
    "http://videos.intelite.com.br/a.mp4", "javascript:alert(1)", "data:text/html,x", "https://evil.com/a.mp4",
    "https://videos.intelite.com.br.evil.com/a.mp4", "https://u:p@videos.intelite.com.br/a.mp4", "https://videos.intelite.com.br:8443/a.mp4", "nada",
  ])("rejeita %s", (u) => expect(resolveVideo(u, hosts).ok).toBe(false));
  it("não trata sufixo parcial como subdomínio", () => {
    expect(resolveVideo("https://notvimeo.com/1", ["vimeo.com"]).ok).toBe(false);
  });
  it("interpreta a lista de domínios", () => {
    expect(parseHosts("A.com\nb.com, lixo ,c.com.br")).toEqual(["a.com", "b.com", "c.com.br"]);
    expect(parseHosts(null)).toEqual(DEFAULT_VIDEO_HOSTS);
  });
});

describe("upload", () => {
  it("reconhece imagem pelos bytes", () => {
    expect(sniffImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(sniffImage(new TextEncoder().encode("<script>"))).toBeNull();
  });
});

describe("navegação: não pula verificações", () => {
  const base = { installed: false, framing: "NAO_VERIFICADO", status: "EM_ANDAMENTO" } as unknown as Submission;
  const photo = (review: Photo["review"] = "PENDENTE", t = 1): Photo => ({ id: `p${t}`, type: "TELA", review, createdAt: new Date(t) }) as Photo;
  it("cada fase exige a anterior concluída", () => {
    expect(unlockedSteps(base, [])).toEqual([true, false, false, false]);
    const a = { ...base, installed: true } as Submission;
    expect(unlockedSteps(a, [])).toEqual([true, true, false, false]);
    const b = { ...a, framing: "INCORRETO" } as Submission;
    expect(unlockedSteps(b, [])).toEqual([true, true, false, false]); // problema aberto bloqueia a foto
    const c = { ...a, framing: "CORRETO" } as Submission;
    expect(unlockedSteps(c, [])).toEqual([true, true, true, false]);
    expect(unlockedSteps({ ...a, framing: "PRECISA_SUPORTE" } as Submission, [])[2]).toBe(true); // pedir suporte também segue
    expect(unlockedSteps(c, [photo()])).toEqual([true, true, true, true]);
  });
  it("marca como concluídas só as fases realmente feitas", () => {
    const c = { ...base, installed: true, framing: "CORRETO" } as Submission;
    expect(doneSteps(c, [])).toEqual([true, true, false, false]);
    expect(doneSteps(c, [photo()])).toEqual([true, true, true, false]);
    expect(doneSteps({ ...c, status: "ENVIADO" } as Submission, [photo()])).toEqual([true, true, true, true]);
  });
  it("foto marcada para refazer volta a exigir foto; uma nova aceitável substitui", () => {
    const c = { ...base, installed: true, framing: "CORRETO" } as Submission;
    expect(photoOk([photo("REFAZER", 1)])).toBe(false);
    expect(unlockedSteps(c, [photo("REFAZER", 1)])[3]).toBe(false);
    expect(photoOk([photo("REFAZER", 1), photo("PENDENTE", 2)])).toBe(true);
    expect(photoOk([photo("REFAZER", 1), photo("REFAZER", 2)])).toBe(false);
    expect(pendingRedo([photo("REFAZER", 1), photo("PENDENTE", 2)])).toHaveLength(0);
    expect(photoOk([])).toBe(false);
  });
});

describe("indicadores", () => {
  const row = (o: Partial<StatRow>): StatRow => ({ status: "EM_ANDAMENTO", framing: "NAO_VERIFICADO", confirmed: false, helpRequested: false, helpResolved: false, pendingPhotos: 0, installed: false, photoCount: 0, ...o });
  it("separa declarado de confirmado e conta o que está em aberto", () => {
    const s = computeStats([
      row({ status: "APROVADO", framing: "CORRETO", confirmed: true }),
      row({ status: "ENVIADO", framing: "INCORRETO", helpRequested: true, pendingPhotos: 2 }),
      row({ framing: "PRECISA_SUPORTE" }),
      row({}),
    ]);
    expect(s.total).toBe(4);
    expect(s.tela).toMatchObject({ confirmadas: 1, declaradasCorretas: 1, comProblema: 1, suporte: 1 });
    expect(s.fotosParaAnalisar).toBe(2);
    expect(s.pedidosDeAjuda).toBe(1); // em aberto
    expect(computeStats([row({ helpRequested: true, helpResolved: true })]).pedidosDeAjuda).toBe(0); // atendido sai do aberto
  });
  it("funil: cada etapa conta quem chegou até ela, a partir dos campos reais", () => {
    const f = computeStats([
      row({ installed: true, framing: "CORRETO", photoCount: 1, status: "ENVIADO" }),
      row({ installed: true, framing: "INCORRETO" }),
      row({ installed: true }),
      row({}),
    ]).funil;
    expect(f.map((x) => x.count)).toEqual([4, 3, 2, 1, 1]);
    expect(f[0].label).toBe("Iniciaram");
    expect(f[f.length - 1].label).toBe("Concluíram o envio");
  });
  it("tempo típico: mediana entre iniciar e enviar, ignorando quem não concluiu", () => {
    const at = (min: number) => new Date(Date.UTC(2026, 10, 1, 10, min));
    const rows = [
      row({ createdAt: at(0), submittedAt: at(6) }),
      row({ createdAt: at(0), submittedAt: at(10) }),
      row({ createdAt: at(0), submittedAt: at(30) }),
      row({ createdAt: at(0), submittedAt: null }),
    ];
    expect(medianMinutes(rows)).toBe(10);
    expect(medianMinutes([row({})])).toBeNull(); // sem base: null, não 0
  });
});

describe("download direto: Range (retomar download)", () => {
  it("interpreta intervalos válidos", () => {
    expect(parseRange(null, 1000)).toBeNull();
    expect(parseRange("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=900-", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=0-5000", 1000)).toEqual({ start: 0, end: 999 }); // limita ao tamanho
  });
  it("rejeita intervalos inválidos e ignora múltiplos", () => {
    expect(parseRange("bytes=1000-", 1000)).toBe("invalid");
    expect(parseRange("bytes=5-2", 1000)).toBe("invalid");
    expect(parseRange("bytes=-", 1000)).toBe("invalid");
    expect(parseRange("bytes=-0", 1000)).toBe("invalid");
    expect(parseRange("abc", 1000)).toBe("invalid");
    expect(parseRange("bytes=0-1,5-6", 1000)).toBeNull(); // vários intervalos: arquivo inteiro
  });
});

describe("links de download", () => {
  it("aceita https, completa o esquema e remove duplicados", () => {
    expect(sanitizeLinks(["bit.ly/aitotem26", " https://shre.ink/aitotem26 ", "bit.ly/aitotem26", ""])).toEqual({
      ok: true,
      links: ["https://bit.ly/aitotem26", "https://shre.ink/aitotem26"],
    });
  });
  it.each(["http://bit.ly/x", "https://u:p@bit.ly/x", "javascript:alert(1)", "não é link"])("rejeita %s", (l) => {
    expect(sanitizeLinks([l]).ok).toBe(false);
  });
  it("limita a 5 por aplicativo", () => {
    expect(sanitizeLinks(Array.from({ length: 6 }, (_, i) => "a" + i + ".com")).ok).toBe(false);
  });
});

describe("verificação de ambiente em produção (evita subir com valores de exemplo)", () => {
  const ok = { DATABASE_URL: "postgresql://u:p@dpg-abc123-a:5432/intelite", SESSION_SECRET: "a".repeat(48), ADMIN_PASSWORD: "Uma-senha-bem-forte-2026" };
  it("aceita uma configuração real", () => {
    expect(checkEnv(ok)).toEqual([]);
    expect(checkEnv({ ...ok, ADMIN_PASSWORD: undefined })).toEqual([]); // o seed decide se precisa
  });
  it("recusa o banco local copiado do .env.example", () => {
    const r = checkEnv({ ...ok, DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/intelite?schema=public" });
    expect(r.join(" ")).toMatch(/localhost/);
    expect(checkEnv({ ...ok, DATABASE_URL: "postgresql://u:p@localhost:5433/x", ALLOW_LOCAL_DB: "true" })).toEqual([]);
  });
  it("recusa segredo e senha de exemplo", () => {
    expect(checkEnv({ ...ok, SESSION_SECRET: "troque-este-valor-por-um-segredo-longo-e-aleatorio" }).join(" ")).toMatch(/SESSION_SECRET/);
    expect(checkEnv({ ...ok, SESSION_SECRET: "curto" }).join(" ")).toMatch(/32 caracteres/);
    expect(checkEnv({ ...ok, ADMIN_PASSWORD: "trocar-esta-senha-123" }).join(" ")).toMatch(/ADMIN_PASSWORD/);
  });
  it("reporta tudo de uma vez quando o .env.example inteiro foi importado", () => {
    const r = checkEnv({ DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/intelite?schema=public", SESSION_SECRET: "troque-este-valor-por-um-segredo-longo-e-aleatorio", ADMIN_PASSWORD: "trocar-esta-senha-123" });
    expect(r.length).toBe(3);
  });
  it("recusa DATABASE_URL ausente ou inválida", () => {
    expect(checkEnv({ ...ok, DATABASE_URL: undefined }).join(" ")).toMatch(/não está definida/);
    expect(checkEnv({ ...ok, DATABASE_URL: "isto não é url" }).join(" ")).toMatch(/válida/);
  });
});
