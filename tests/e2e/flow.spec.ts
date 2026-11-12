import { PrismaClient } from "@prisma/client";
import { expect, request, test, type Page } from "@playwright/test";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const DB = "postgresql://postgres:postgres@localhost:5546/intelite_e2e";
const ADMIN = { email: "admin@intelite.local", password: "senha-e2e-123456" };
const next = (p: Page) => p.getByRole("button", { name: /^Continuar/ }).click();
const phaseTitle = (p: Page, name: string) => p.getByRole("heading", { level: 1, name });

test("download do aplicativo: links, APK direto com Range e links editáveis", async ({ request }) => {
  const info = await (await request.get("/api/downloads")).json();
  // aplicativo híbrido: um só, para totem e painel
  expect(info.links).toEqual(["https://is.gd/aihib19", "https://v.gd/aihib19"]);
  expect(info.direct).toBe("/api/download");
  expect(info.sizeBytes).toBeGreaterThan(1_000_000);

  const full = await request.get("/api/download");
  expect(full.status()).toBe(200);
  expect(full.headers()["content-type"]).toBe("application/vnd.android.package-archive");
  expect(full.headers()["content-disposition"]).toMatch(/filename="AI_Hibrido_[\d.]+\.apk"/);
  expect(full.headers()["accept-ranges"]).toBe("bytes");
  const body = await full.body();
  expect(body.length).toBe(info.sizeBytes);
  expect(body.subarray(0, 2).toString()).toBe("PK"); // APK é um ZIP

  // retomar download: Range
  const part = await request.get("/api/download", { headers: { Range: "bytes=0-3" } });
  expect(part.status()).toBe(206);
  expect(part.headers()["content-range"]).toMatch(/^bytes 0-3\/\d+$/);
  expect((await part.body()).toString()).toBe("PK\u0003\u0004");
  expect((await request.get("/api/download", { headers: { Range: "bytes=999999999-" } })).status()).toBe(416);

  // vídeos do tutorial: streaming com Range, legendas e lista permitida
  const mp4 = await request.get("/api/videos/ajustar.mp4", { headers: { Range: "bytes=0-1023" } });
  expect(mp4.status()).toBe(206);
  expect(mp4.headers()["content-type"]).toBe("video/mp4");
  expect(mp4.headers()["content-range"]).toMatch(/^bytes 0-1023\/\d+$/);
  expect((await mp4.body()).length).toBe(1024);
  expect((await request.get("/api/videos/ajustar.jpg")).headers()["content-type"]).toBe("image/jpeg");
  expect((await request.get("/api/videos/ajustar.mp4", { headers: { Range: "bytes=999999999-" } })).status()).toBe(416);
  for (const ruim of ["outro.mp4", "..%2Fpackage.json", "ajustar.exe", "ajustar.mp4.txt", "remover.mp4", "tutorial.json"]) {
    expect((await request.get(`/api/videos/${ruim}`)).status(), ruim).toBe(404);
  }
  // vídeo principal do guia: capítulos e legendas vêm junto do conteúdo
  const content = await (await request.get("/api/content")).json();
  expect(content.steps.map((s: { key: string }) => s.key)).toEqual(["atualizar", "conferir", "correcao", "fotos"]);
  if (content.guideVideo) { // enquanto o vídeo novo não foi gravado, a página mostra um aviso no lugar do player
    expect(content.guideVideo.chapters.length).toBeGreaterThanOrEqual(4);
    expect((await request.get(content.guideVideo.src, { headers: { Range: "bytes=0-99" } })).status()).toBe(206);
    if (content.guideVideo.captions) expect((await request.get(content.guideVideo.captions)).headers()["content-type"]).toContain("text/vtt");
  }

  // links editáveis só pelo admin, somente https
  expect((await request.put("/api/admin/settings", { data: { links: [] } })).status()).toBe(401);
  expect((await request.post("/api/admin/login", { data: ADMIN })).status()).toBe(200);
  expect((await request.put("/api/admin/settings", { data: { links: ["http://inseguro.com/x"] } })).status()).toBe(400);
  expect((await request.put("/api/admin/settings", { data: { links: ["bit.ly/novo-app"] } })).status()).toBe(200);
  expect((await (await request.get("/api/downloads")).json()).links).toEqual(["https://bit.ly/novo-app"]);

  // padrões antigos (totem/painel separados) ainda salvos no banco passam para o aplicativo atual; edições da equipe ficam
  const prisma = new PrismaClient({ datasources: { db: { url: DB } } });
  try {
    await prisma.setting.deleteMany({ where: { key: "appLinks" } });
    await prisma.setting.upsert({ where: { key: "downloadLinks" }, update: { value: JSON.stringify({ totem: ["https://bit.ly/aitotem26", "https://shre.ink/aitotem26"], painel: ["https://bit.ly/aipainel26", "https://shre.ink/aipainel26"] }) }, create: { key: "downloadLinks", value: JSON.stringify({ totem: ["https://bit.ly/aitotem26", "https://shre.ink/aitotem26"], painel: ["https://bit.ly/aipainel26", "https://shre.ink/aipainel26"] }) } });
    expect((await (await request.get("/api/downloads")).json()).links).toEqual(["https://is.gd/aihib19", "https://v.gd/aihib19"]);
    await prisma.setting.update({ where: { key: "downloadLinks" }, data: { value: JSON.stringify({ totem: ["https://exemplo.com/editado"], painel: [] }) } });
    expect((await (await request.get("/api/downloads")).json()).links).toEqual(["https://exemplo.com/editado"]);
    await prisma.setting.delete({ where: { key: "downloadLinks" } });
  } finally {
    await prisma.$disconnect();
  }
});

test("cliente conclui o guia no celular; equipe confirma; indicadores refletem", async ({ page, browser }) => {
  await page.goto("/");
  await expect(page.getByAltText("Intelite Tecnologia").first()).toBeVisible();
  // abertura: a pergunta, a solução e só nome + empresa
  await expect(phaseTitle(page, "Quer atualizar seu app Intelite?")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Atendimento Inteligente/ })).toBeChecked();
  await expect(page.getByLabel("E-mail")).toHaveCount(0);
  await page.getByRole("button", { name: /Ver o passo a passo/ }).click();
  await expect(page.getByText("Informe o seu nome.")).toBeVisible(); // validação com mensagem
  await page.getByLabel("Seu nome").fill("Maria");
  await page.getByLabel("Nome da empresa").fill("Empresa Teste");
  await page.getByRole("button", { name: /Ver o passo a passo/ }).click();

  // fase 1: vídeo e passo a passo ao mesmo tempo, sem desinstalar o app antigo
  await expect(phaseTitle(page, "Atualizar o aplicativo")).toBeVisible();
  const hasVideo = !!(await (await page.request.get("/api/content")).json()).guideVideo;
  if (hasVideo) await expect(page.getByRole("button", { name: /Reproduzir vídeo: Como atualizar o aplicativo/ })).toBeVisible();
  else await expect(page.getByText("O vídeo completo está sendo preparado")).toBeVisible();
  // o texto mostra só o passo em andamento (nada de lista inteira) e a tela cabe sem rolagem vertical
  const h2 = (t: string) => page.getByRole("heading", { level: 2, name: t });
  await expect(h2("Prepare o Mini PC")).toBeVisible();
  await expect(page.getByText("Passo 1 de 4")).toBeVisible();
  for (const t of ["Baixe o aplicativo", "Instale por cima da versão atual", "Abra e aguarde carregar"]) await expect(h2(t)).toHaveCount(0);
  await expect(page.getByText("Remover a versão anterior")).toHaveCount(0);
  await expect(page.getByText("Mostrar apps do sistema")).toHaveCount(0);
  await expect(page.getByText("Escolha o formato")).toHaveCount(0); // texto e vídeo juntos: não há mais escolha de formato
  const overflowY = () => page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight);
  expect(await overflowY()).toBeLessThanOrEqual(2);
  await expect(page.getByRole("button", { name: /Anterior/ })).toBeDisabled();
  await page.getByRole("button", { name: /Próximo passo/ }).click();
  await expect(h2("Baixe o aplicativo")).toBeVisible();
  await expect(h2("Prepare o Mini PC")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /is\.gd\/aihib19/ })).toBeVisible(); // opção 1
  await expect(page.getByRole("link", { name: /v\.gd\/aihib19/ })).toBeVisible(); // opção 2
  await expect(page.getByText("É o mesmo aplicativo para o totem e para o painel").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Baixar direto desta página/ })).toBeVisible(); // opção 3
  await expect(page.getByText(/copie o APK para um pendrive/)).toBeVisible();
  expect(await overflowY()).toBeLessThanOrEqual(2);
  await page.getByRole("button", { name: /Próximo passo/ }).click();
  await expect(h2("Instale por cima da versão atual")).toBeVisible();
  await expect(page.getByText(/Você não precisa desinstalar nada/)).toBeVisible();
  // escolher um capítulo do vídeo troca o passo mostrado (e o vídeo vai ao capítulo)
  if (hasVideo) {
    await page.getByRole("button", { name: /^1 Preparar/ }).click();
    await expect(h2("Prepare o Mini PC")).toBeVisible();
    await expect(page.locator("video")).toBeVisible();
    await page.getByRole("button", { name: /^2 Baixar/ }).click();
    await expect(h2("Baixe o aplicativo")).toBeVisible();
    await expect(page.getByRole("button", { name: /^2 Baixar/ })).toHaveAttribute("aria-current", "step");
    await page.getByRole("button", { name: /^3 Instalar/ }).click();
    await expect(h2("Instale por cima da versão atual")).toBeVisible();
  }
  await page.getByRole("button", { name: /Próximo passo/ }).click();
  await expect(h2("Abra e aguarde carregar")).toBeVisible();
  await expect(page.getByText("Passo 4 de 4")).toBeVisible();
  // fases seguintes bloqueadas até concluir esta
  await expect(page.getByRole("button", { name: /Foto/ })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("button", { name: /^Continuar/ })).toBeDisabled();
  await page.getByLabel(/Terminei a atualização/).click();
  await expect(page.getByLabel(/Terminei a atualização/)).toBeChecked();
  await next(page);

  // fase 2: conferir a tela (lista informativa; problema → tutorial de ajuste → conferir de novo)
  await expect(phaseTitle(page, "Conferir a tela")).toBeVisible();
  await expect(page.getByText("O que precisa estar correto")).toBeVisible();
  await expect(page.getByText("Textos, botões, logotipo e números das senhas não estão cortados.")).toBeVisible();
  await expect(page.locator("main input[type=checkbox]")).toHaveCount(0); // nada para marcar
  await expect(page.getByRole("button", { name: /^Continuar/ })).toBeDisabled();
  await page.getByRole("button", { name: /Minha tela está cortada ou desalinhada/ }).click();
  await expect(phaseTitle(page, "Minha tela está cortada ou desalinhada")).toBeVisible();
  await expect(page.getByText("Ajustar a proporção da tela (TV Box SmartPRO)")).toBeVisible();
  await expect(page.getByText("Ajuste necessário")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Continuar/ })).toBeDisabled();
  await page.getByRole("button", { name: /Já fiz o ajuste/ }).click();
  await page.getByRole("button", { name: /Está tudo certo/ }).click();
  await expect(page.getByText(/A equipe da Intelite vai conferir/)).toBeVisible(); // declarado ≠ confirmado
  await next(page);

  // fase 3: foto
  await expect(phaseTitle(page, "Enviar uma foto")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Continuar/ })).toBeDisabled();
  await page.locator("input[type=file]").setInputFiles({ name: "t.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("Foto 1 da tela enviada")).toBeVisible();
  await next(page);

  // fase 4: finalizar
  await expect(phaseTitle(page, "Finalizar")).toBeVisible();
  await page.getByRole("radio", { name: "5 de 5" }).click();
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Recebemos o seu envio")).toBeVisible();
  await expect(page.getByText("(concluída)")).toHaveCount(4); // as quatro fases aparecem como concluídas
  await expect(page.getByRole("button", { name: "Preciso de ajuda" })).toHaveCount(0);
  await page.request.patch("/api/submissions/me", { data: { help: { message: "Não achei o botão", step: "Finalizar" } } });

  // retomar: recarregar mantém o progresso (cookie) e reabre a fase atual
  await page.reload();
  await expect(page.getByText("Recebemos o seu envio")).toBeVisible();

  // admin
  const admin = await (await browser.newContext({ baseURL: "http://localhost:3200" })).newPage();
  await admin.goto("/admin/login");
  await expect(admin.getByAltText("Intelite Tecnologia").first()).toBeVisible();
  await admin.getByLabel("E-mail").fill(ADMIN.email);
  await admin.getByLabel("Senha").fill(ADMIN.password);
  await admin.getByRole("button", { name: "Entrar" }).click();
  await expect(admin.getByRole("heading", { name: "Envios" })).toBeVisible();
  await expect(admin.locator(".kpi", { hasText: "Aguardando a equipe" }).locator(".n")).toHaveText("1");
  await expect(admin.locator(".kpi", { hasText: "Telas confirmadas pela equipe" }).locator(".n")).toHaveText("0"); // declarado ≠ confirmado
  await expect(admin.locator(".kpi", { hasText: "Pedidos de ajuda em aberto" }).locator(".n")).toHaveText("1");
  await expect(admin.getByText("Atualizaram o aplicativo")).toBeVisible();

  // exportação CSV
  const csv = await admin.request.get("/api/admin/export");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain("Empresa Teste");

  await admin.getByRole("row", { name: /Empresa Teste/ }).getByRole("link", { name: /Abrir/ }).click();
  await expect(admin.getByRole("heading", { name: /Maria/ })).toBeVisible();
  await admin.getByRole("button", { name: /Confirmar enquadramento/ }).click();
  await expect(admin.getByText(/Aprove uma foto antes de confirmar/)).toBeVisible();

  // pedido de ajuda: aparece e é marcado como atendido
  await expect(admin.locator(".alert strong", { hasText: "Pediu ajuda" })).toBeVisible();
  await admin.getByRole("button", { name: "Marcar como atendido" }).click();
  await expect(admin.getByText("Pedido de ajuda atendido")).toBeVisible();

  // pede nova foto; o cliente é avisado e reenvia
  await admin.getByRole("button", { name: "Pedir nova foto" }).click();
  await admin.getByLabel(/Motivo/).fill("A borda direita não aparece.");
  await admin.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(admin.getByText("Precisa de ajuste").first()).toBeVisible();
  await page.reload();
  await expect(phaseTitle(page, "Enviar uma foto")).toBeVisible(); // o cliente volta direto à fase da foto
  await expect(page.getByText("A borda direita não aparece.")).toBeVisible();
  await page.locator("input[type=file]").setInputFiles({ name: "p2.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("Foto 2 da tela enviada")).toBeVisible();
  await expect(page.getByText("A borda direita não aparece.")).toHaveCount(0);

  // aprova a foto nova e confirma (só então "confirmado")
  await admin.reload();
  await admin.getByRole("button", { name: "Aprovar foto" }).last().click();
  await expect(admin.getByText("Aprovada", { exact: true })).toBeVisible();
  await admin.getByRole("button", { name: /Confirmar enquadramento/ }).click();
  await expect(admin.getByText("Equipe: confirmado")).toBeVisible();
  await admin.getByRole("button", { name: "Ampliar foto" }).first().click();
  await expect(admin.getByRole("dialog")).toBeVisible();
  await admin.getByRole("button", { name: "Fechar" }).click();

  // usuários do admin: criar, entrar com ele e desativar
  await admin.goto("/admin/usuarios");
  await admin.getByLabel("Nome", { exact: true }).fill("Equipe Suporte");
  await admin.getByLabel("E-mail").fill("suporte@intelite.local");
  await admin.getByLabel(/Senha inicial/).fill("senha-suporte-12345");
  await admin.getByRole("button", { name: "Criar usuário" }).click();
  await expect(admin.getByText(/Usuário suporte@intelite.local criado/)).toBeVisible();
  const outro = await (await browser.newContext({ baseURL: "http://localhost:3200" })).newPage();
  await outro.goto("/admin/login");
  await outro.getByLabel("E-mail").fill("suporte@intelite.local");
  await outro.getByLabel("Senha").fill("senha-suporte-12345");
  await outro.getByRole("button", { name: "Entrar" }).click();
  await expect(outro.getByRole("heading", { name: "Envios" })).toBeVisible();
  await admin.getByRole("row", { name: /suporte@intelite.local/ }).getByRole("button", { name: "Desativar" }).click();
  await expect(admin.getByRole("row", { name: /suporte@intelite.local/ }).getByText("desativado")).toBeVisible();
  await outro.reload();
  await expect(outro).toHaveURL(/\/admin\/login/); // usuário desativado perde o acesso na hora
  await admin.getByRole("row", { name: /admin@intelite.local/ }).getByRole("button", { name: "Desativar" }).click();
  await expect(admin.getByText(/não pode desativar o seu próprio usuário/)).toBeVisible();

  // trocar a senha do admin
  await admin.goto("/admin/conta");
  await admin.getByLabel("Senha atual").fill(ADMIN.password);
  await admin.getByLabel("Nova senha (mín. 10 caracteres)").fill("outra-senha-e2e-9876");
  await admin.getByLabel("Repita a nova senha").fill("outra-senha-e2e-9876");
  await admin.getByRole("button", { name: "Salvar" }).click();
  await expect(admin.getByText("Senha alterada.")).toBeVisible();

  // volta à senha original para não afetar os demais testes
  await admin.reload();
  await admin.getByLabel("Senha atual").fill("outra-senha-e2e-9876");
  await admin.getByLabel("Nova senha (mín. 10 caracteres)").fill(ADMIN.password);
  await admin.getByLabel("Repita a nova senha").fill(ADMIN.password);
  await admin.getByRole("button", { name: "Salvar" }).click();
  await expect(admin.getByText("Senha alterada.")).toBeVisible();

  // excluir o envio (LGPD)
  await admin.goto("/admin");
  await admin.getByRole("row", { name: /Empresa Teste/ }).getByRole("link", { name: /Abrir/ }).click();
  admin.once("dialog", (d) => d.accept());
  await admin.getByRole("button", { name: "Excluir envio" }).click();
  await expect(admin.getByRole("heading", { name: "Envios" })).toBeVisible();
  await expect(admin.getByText("Ainda não há envios.")).toBeVisible();
});

test("as fases seguem a ordem, também no servidor", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Seu nome").fill("Paulo Ordem");
  await page.getByLabel("Nome da empresa").fill("Empresa Ordem Certa");
  await page.getByRole("button", { name: /Ver o passo a passo/ }).click();
  await expect(phaseTitle(page, "Atualizar o aplicativo")).toBeVisible();
  const patch = (data: object) => page.request.patch("/api/submissions/me", { data });
  expect((await patch({ step: 1 })).status()).toBe(409); // sem concluir a atualização
  expect((await patch({ installed: true, step: 1 })).status()).toBe(200);
  expect((await patch({ step: 2 })).status()).toBe(409); // sem conferir a tela
  expect((await patch({ framing: { outcome: "INCORRETO", issues: [] }, step: 2 })).status()).toBe(409); // problema aberto bloqueia a foto
  expect((await patch({ framing: { outcome: "CORRETO", issues: [] }, step: 2 })).status()).toBe(200);
  expect((await patch({ step: 3 })).status()).toBe(409); // sem foto
  expect((await page.request.post("/api/submissions/me/submit", { data: { rating: 5 } })).status()).toBe(409); // enviar sem foto também falha
  // a tela mostra o bloqueio
  await page.reload();
  await expect(phaseTitle(page, "Enviar uma foto")).toBeVisible();
  await expect(page.getByRole("button", { name: /Finalizar/ })).toHaveAttribute("aria-disabled", "true");
  // limpeza
  const admin = await request.newContext({ baseURL: "http://localhost:3200" });
  await admin.post("/api/admin/login", { data: ADMIN });
  const { items } = await (await admin.get("/api/admin/submissions?q=Empresa Ordem Certa")).json();
  for (const it of items) await admin.delete(`/api/admin/submissions/${it.id}`);
  await admin.dispose();
});

test("cliente com várias lojas: reiniciar começa um envio novo e mantém o anterior", async ({ request }) => {
  const a = await request.post("/api/submissions", { data: { company: "Rede Multi", contactName: "Loja A" } });
  expect(a.status()).toBe(200);
  const idA = (await (await request.get("/api/submissions/me")).json()).submission.id;
  expect((await request.post("/api/submissions/reset")).status()).toBe(200);
  expect(await (await request.get("/api/submissions/me")).json()).toBeNull(); // aparelho livre para outro envio
  await request.post("/api/submissions", { data: { company: "Rede Multi", contactName: "Loja B" } });
  const idB = (await (await request.get("/api/submissions/me")).json()).submission.id;
  expect(idB).not.toBe(idA); // envio novo, o anterior segue registrado no admin
});

test("rotas protegidas, saúde e página 404", async ({ page, request }) => {
  expect((await request.get("/api/health")).status()).toBe(200);
  expect((await request.get("/api/admin/submissions")).status()).toBe(401);
  expect((await request.get("/api/admin/export")).status()).toBe(401);
  expect(await (await request.get("/api/submissions/me")).json()).toBeNull();
  expect((await request.post("/api/admin/login", { data: { email: "x@y.com", password: "errada" } })).status()).toBe(401);
  expect((await request.post("/api/submissions", { data: { company: "x" } })).status()).toBe(400);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto("/nao-existe");
  await expect(page.getByText("Página não encontrada")).toBeVisible();
});
