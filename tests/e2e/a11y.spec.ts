import AxeBuilder from "@axe-core/playwright";
import { expect, request, test, type Page } from "@playwright/test";
import fs from "node:fs";

/**
 * Auditoria automática de acessibilidade (axe-core, WCAG 2.2 AA + boas práticas) em todas as telas reais,
 * nos dois lados (cliente e admin), em tema claro e escuro, no celular e no desktop.
 * O axe cobre o que é mecanicamente verificável (contraste, nomes, rótulos, landmarks, ordem de títulos);
 * foco por teclado e legibilidade em zoom são conferidos nos testes abaixo e por revisão visual.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

interface Finding { project: string; screen: string; scheme: string; rule: string; impact: string; help: string; nodes: number; sample: string }
const findings: Finding[] = [];

async function scan(page: Page, project: string, screen: string) {
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.waitForTimeout(250);
    const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    for (const v of r.violations) {
      findings.push({ project, screen, scheme, rule: v.id, impact: v.impact ?? "n/a", help: v.help, nodes: v.nodes.length, sample: v.nodes[0]?.target.join(" ") ?? "" });
    }
  }
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
}

test("acessibilidade automática: cliente e admin, claro e escuro", async ({ page, browser }, info) => {
  const project = info.project.name;
  const api = page.request;

  // ── cliente ──
  await page.goto("/");
  await page.getByLabel("Seu nome").waitFor();
  await scan(page, project, "cliente: abertura");

  await api.post("/api/submissions", { data: { company: "Rede Exemplo Ltda", contactName: "Maria Souza" } });
  await page.reload();
  await page.getByRole("heading", { level: 1, name: "Atualizar o aplicativo" }).waitFor();
  await page.getByText("Opção 2").waitFor();
  await scan(page, project, "cliente: atualizar (vídeo e passos)");

  if (await page.getByRole("button", { name: "Ver no vídeo" }).count()) {
    await page.getByRole("button", { name: "Ver no vídeo" }).nth(1).click();
    await page.locator("video").waitFor();
    await scan(page, project, "cliente: atualizar (vídeo tocando)");
  }

  await api.patch("/api/submissions/me", { data: { installed: true, step: 1 } });
  await page.reload();
  await page.getByText("O que precisa estar correto").waitFor();
  await scan(page, project, "cliente: conferir a tela");

  await page.getByRole("button", { name: /Minha tela está cortada ou desalinhada/ }).click();
  await page.getByText("Ajuste necessário").waitFor();
  await scan(page, project, "cliente: ajuste de tela");

  await api.patch("/api/submissions/me", { data: { framing: { outcome: "CORRETO", issues: [] }, step: 2 } });
  await page.reload();
  await page.getByRole("heading", { level: 1, name: "Enviar uma foto" }).waitFor();
  await scan(page, project, "cliente: foto (vazio)");

  await api.post("/api/submissions/me/photos", { multipart: { file: { name: "f.png", mimeType: "image/png", buffer: PNG } } });
  await page.reload();
  await page.getByAltText("Foto 1 da tela enviada").waitFor();
  await scan(page, project, "cliente: foto (enviada)");

  await api.patch("/api/submissions/me", { data: { step: 3 } });
  await page.reload();
  await page.getByText("Como foi a experiência?").waitFor();
  await scan(page, project, "cliente: finalizar");

  await api.post("/api/submissions/me/submit", { data: { rating: 5 } });
  await page.reload();
  await page.getByText("Recebemos o seu envio").waitFor();
  await scan(page, project, "cliente: enviado");

  // ── admin ──
  const ctx = await browser.newContext({ baseURL: "http://localhost:3200", viewport: info.project.use.viewport ?? undefined, ...(info.project.use.isMobile ? { isMobile: true, hasTouch: true, userAgent: info.project.use.userAgent } : {}) });
  const admin = await ctx.newPage();
  await admin.goto("/admin/login");
  await admin.getByLabel("E-mail").waitFor();
  await scan(admin, project, "admin: login");

  const login = await ctx.request.post("/api/admin/login", { data: { email: "admin@intelite.local", password: "senha-e2e-123456" } });
  expect(login.status()).toBe(200);
  const list = await (await ctx.request.get("/api/admin/submissions")).json();
  const id = list.items[0].id as string;

  for (const [path, ready, name] of [
    ["/admin", "Envios", "admin: painel"],
    [`/admin/envios/${id}`, "Linha do tempo", "admin: envio"],
    ["/admin/conteudo", "Conteúdo do tutorial", "admin: conteúdo"],
    ["/admin/usuarios", "Novo usuário", "admin: usuários"],
    ["/admin/conta", "Alterar senha", "admin: conta"],
    ["/nao-existe", "Página não encontrada", "404"],
  ] as const) {
    await admin.goto(path);
    await admin.getByText(ready, { exact: false }).first().waitFor();
    await scan(admin, project, name);
  }

  // ── limpeza (para não afetar os demais testes) ──
  for (const s of list.items) await ctx.request.delete(`/api/admin/submissions/${s.id}`);
  await ctx.close();

  // ── relatório ──
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync(`test-results/a11y-${project}.json`, JSON.stringify(findings, null, 2));
  const grouped = new Map<string, Finding[]>();
  for (const f of findings) grouped.set(`${f.rule} (${f.impact})`, [...(grouped.get(`${f.rule} (${f.impact})`) ?? []), f]);
  const resumo = [...grouped.entries()].map(([k, v]) => `${k}: ${v.length} ocorrência(s) em ${[...new Set(v.map((x) => x.screen))].join(", ")} — ex.: ${v[0].sample}`).join("\n");
  console.log(resumo || "Nenhuma violação encontrada.");
  expect(findings, `Violações de acessibilidade:\n${resumo}`).toEqual([]);
});

test.describe("teclado e zoom", () => {
  test("o fluxo inicial é operável só com teclado e o foco é visível", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Seu nome").waitFor();
    // o primeiro Tab leva ao link de pular para o conteúdo (quando existir) ou ao primeiro campo
    await page.keyboard.press("Tab");
    const first = await page.evaluate(() => document.activeElement?.textContent?.trim() || (document.activeElement as HTMLInputElement)?.name || document.activeElement?.tagName);
    expect(first).toBeTruthy();
    await page.getByLabel("Seu nome").focus();
    await page.keyboard.type("Teclado Teste");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Empresa do Teclado");
    // o foco precisa ter contorno visível (não só a cor da borda)
    const outline = await page.evaluate(() => {
      const s = getComputedStyle(document.activeElement as Element);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThanOrEqual(2);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter"); // botão "Ver o passo a passo"
    await expect(page.getByRole("heading", { level: 1, name: "Atualizar o aplicativo" })).toBeVisible();

    // limpeza: apaga o envio criado por este teste (para não interferir nos demais)
    const admin = await request.newContext({ baseURL: "http://localhost:3200" });
    await admin.post("/api/admin/login", { data: { email: "admin@intelite.local", password: "senha-e2e-123456" } });
    const { items } = await (await admin.get("/api/admin/submissions?q=Empresa do Teclado")).json();
    for (const it of items) await admin.delete(`/api/admin/submissions/${it.id}`);
    await admin.dispose();
  });

  test("zoom de 200% não gera rolagem horizontal", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Seu nome").waitFor();
    await page.addStyleTag({ content: "html { font-size: 200% !important }" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
