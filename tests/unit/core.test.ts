import { describe, expect, it } from "vitest";
import type { Photo, Submission } from "@prisma/client";
import { resolveVideo, parseHosts, DEFAULT_VIDEO_HOSTS } from "@/lib/video";
import { computeStats, type StatRow } from "@/lib/stats";
import { maxStep } from "@/lib/submissions";
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
  const base = { format: null, totemUpdated: false, painelUpdated: false, totemFraming: "NAO_VERIFICADO", painelFraming: "NAO_VERIFICADO" } as unknown as Submission;
  const photo = (type: "TOTEM" | "PAINEL", review: Photo["review"] = "PENDENTE", t = 1): Photo =>
    ({ id: `${type}${t}`, type, review, createdAt: new Date(t) }) as Photo;
  it("exige cada etapa na ordem", () => {
    expect(maxStep(base, [])).toBe(1);
    expect(maxStep({ ...base, format: "TEXTO" }, [])).toBe(2);
    const a = { ...base, format: "TEXTO", totemUpdated: true } as Submission;
    expect(maxStep(a, [])).toBe(3);
    const b = { ...a, totemFraming: "INCORRETO" } as Submission;
    expect(maxStep(b, [])).toBe(3); // problema aberto bloqueia
    const c = { ...a, totemFraming: "CORRETO" } as Submission;
    expect(maxStep(c, [])).toBe(4);
    const d = { ...c, painelUpdated: true, painelFraming: "CORRETO" } as Submission;
    expect(maxStep(d, [])).toBe(6);
    expect(maxStep(d, [photo("TOTEM"), photo("PAINEL")])).toBe(7);
  });
  it("foto marcada para refazer volta a exigir foto; a nova substitui", () => {
    const s = { ...base, format: "TEXTO", totemUpdated: true, totemFraming: "CORRETO", painelUpdated: true, painelFraming: "CORRETO" } as Submission;
    expect(maxStep(s, [photo("TOTEM", "REFAZER"), photo("PAINEL")])).toBe(6);
    expect(maxStep(s, [photo("TOTEM", "REFAZER", 1), photo("TOTEM", "PENDENTE", 2), photo("PAINEL")])).toBe(7);
  });
});

describe("indicadores", () => {
  const row = (o: Partial<StatRow>): StatRow => ({ status: "EM_ANDAMENTO", initialFormat: null, formatChanges: 0, totemFraming: "NAO_VERIFICADO", painelFraming: "NAO_VERIFICADO", totemConfirmed: false, painelConfirmed: false, helpRequested: false, helpResolved: false, pendingPhotos: 0, totemUpdated: false, painelUpdated: false, photoCount: 0, ...o });
  it("conta cada cliente uma vez e separa declarado de confirmado", () => {
    const s = computeStats([
      row({ initialFormat: "VIDEO", formatChanges: 2, status: "APROVADO", totemFraming: "CORRETO", painelFraming: "CORRETO", totemConfirmed: true, painelConfirmed: true }),
      row({ initialFormat: "TEXTO", status: "ENVIADO", totemFraming: "CORRETO", painelFraming: "INCORRETO", helpRequested: true, pendingPhotos: 2 }),
      row({}),
    ]);
    expect(s.total).toBe(3);
    expect(s.formato.VIDEO).toMatchObject({ chosen: 1, finished: 1, finishRate: 100, help: 0 });
    expect(s.formato.TEXTO).toMatchObject({ chosen: 1, finished: 1, help: 1, helpRate: 100 });
    expect(s.formato.trocaram).toBe(1);
    expect(s.formato.semEscolha).toBe(1);
    expect(s.formato.VIDEO.chosen + s.formato.TEXTO.chosen + s.formato.semEscolha).toBe(s.total);
    expect(s.totem).toMatchObject({ confirmados: 1, declaradosCorretos: 2 });
    expect(s.painel).toMatchObject({ confirmados: 1, declaradosCorretos: 1, comProblema: 1 });
    expect(s.fotosParaAnalisar).toBe(2);
    expect(s.pedidosDeAjuda).toBe(1); // em aberto
    expect(computeStats([row({ helpRequested: true, helpResolved: true })]).pedidosDeAjuda).toBe(0); // atendido sai do aberto
    expect(computeStats([row({ initialFormat: "TEXTO", helpRequested: true, helpResolved: true })]).formato.TEXTO.help).toBe(1); // mas continua contando na taxa por formato
  });
  it("funil: cada etapa conta quem chegou até ela, a partir dos campos reais", () => {
    const f = computeStats([
      row({ initialFormat: "TEXTO", totemUpdated: true, totemFraming: "CORRETO", painelUpdated: true, painelFraming: "CORRETO", photoCount: 2, status: "ENVIADO" }),
      row({ initialFormat: "VIDEO", totemUpdated: true, totemFraming: "INCORRETO" }),
      row({ initialFormat: "TEXTO", totemUpdated: true }),
      row({}),
    ]).funil;
    expect(f.map((x) => x.count)).toEqual([4, 3, 3, 2, 1, 1, 1, 1]);
    expect(f[0].label).toBe("Iniciaram");
    expect(f[f.length - 1].label).toBe("Concluíram o envio");
  });
  it("devolve null (não 0%) sem base", () => {
    expect(computeStats([]).formato.TEXTO.finishRate).toBeNull();
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
