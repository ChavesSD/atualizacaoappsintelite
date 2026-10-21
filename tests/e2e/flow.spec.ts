import { expect, test, type Page } from "@playwright/test";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const next = (p: Page) => p.getByRole("button", { name: "Continuar →" }).click();
const checkAll = async (p: Page) => { for (const b of await p.locator("label.check input[type=checkbox]").all()) await b.check(); };

test("cliente conclui no celular; equipe confirma; indicadores refletem", async ({ page, browser }) => {
  // dados do cliente (sem login nem código)
  await page.goto("/");
  await expect(page.getByLabel("E-mail")).toHaveCount(0); // só nome e empresa
  await page.getByLabel("Seu nome").fill("Maria");
  await page.getByLabel("Nome da empresa").fill("Empresa Teste");
  await page.getByRole("button", { name: "Começar" }).click();

  // formato
  await expect(page.getByRole("heading", { name: "Formato do tutorial" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar →" })).toBeDisabled();
  await page.getByRole("button", { name: /Tutorial em vídeo/ }).click();
  await next(page);

  // totem: troca de formato sem perder a etapa; não avança sem marcar
  await expect(page.getByRole("heading", { name: "Atualizar o totem" })).toBeVisible();
  await expect(page.getByText("Esta etapa ainda não tem vídeo")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar →" })).toBeDisabled();
  await page.getByRole("group", { name: "Alternar formato" }).getByRole("button", { name: /Texto/ }).click();
  await expect(page.getByRole("heading", { name: "Atualizar o totem" })).toBeVisible();
  await page.getByLabel(/Concluí a atualização do totem/).click();
  await expect(page.getByLabel(/Concluí a atualização do totem/)).toBeChecked();
  await next(page);

  // enquadramento do totem: problema → instruções → conferir de novo
  await expect(page.getByRole("heading", { name: "Conferir a tela do totem" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar →" })).toBeDisabled();
  await page.getByRole("button", { name: "Minha tela está cortada ou desalinhada" }).click();
  await page.getByLabel("Texto cortado").check();
  await page.getByRole("button", { name: "Ver como corrigir" }).click();
  await expect(page.getByText("Problema informado")).toBeVisible();
  await expect(page.getByText("O procedimento oficial desta etapa ainda não foi cadastrado").first()).toBeVisible(); // nada inventado
  await expect(page.getByRole("button", { name: "Continuar →" })).toBeDisabled();
  await page.getByRole("button", { name: /Já fiz o ajuste/ }).click();
  await checkAll(page);
  await page.getByRole("button", { name: /Está tudo certo na tela do totem/ }).click();
  await expect(page.getByText(/Sua confirmação será conferida pela equipe/)).toBeVisible(); // declarado ≠ confirmado
  await next(page);

  // painel
  await page.getByLabel(/Concluí a atualização do painel/).click();
  await expect(page.getByLabel(/Concluí a atualização do painel/)).toBeChecked();
  await next(page);
  await expect(page.getByRole("heading", { name: "Conferir a tela do painel" })).toBeVisible();
  await checkAll(page);
  await page.getByRole("button", { name: /Está tudo certo na tela do painel/ }).click();
  await next(page);

  // fotos
  await expect(page.getByRole("heading", { name: "Fotos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar →" })).toBeDisabled();
  await page.locator("input[type=file]").nth(0).setInputFiles({ name: "t.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("Foto do totem enviada")).toBeVisible();
  await page.locator("input[type=file]").nth(1).setInputFiles({ name: "p.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("Foto do painel de chamadas enviada")).toBeVisible();
  await next(page);

  // enviar
  await expect(page.getByRole("heading", { name: "Enviar" })).toBeVisible();
  await page.getByRole("radio", { name: "5 de 5" }).click();
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Recebemos o seu envio")).toBeVisible();

  // retomar: recarregar mantém o progresso (cookie)
  await page.reload();
  await expect(page.getByText("Recebemos o seu envio")).toBeVisible();

  // admin
  const admin = await (await browser.newContext({ baseURL: "http://localhost:3200" })).newPage();
  await admin.goto("/admin/login");
  await admin.getByLabel("E-mail").fill("admin@intelite.local");
  await admin.getByLabel("Senha").fill("senha-e2e-123456");
  await admin.getByRole("button", { name: "Entrar" }).click();
  await expect(admin.getByRole("heading", { name: "Envios" })).toBeVisible();
  await expect(admin.locator(".kpi", { hasText: "Aguardando a equipe" }).locator(".n")).toHaveText("1");
  await expect(admin.locator(".kpi", { hasText: "Totens confirmados" }).locator(".n")).toHaveText("0"); // declarado ≠ confirmado

  await admin.getByRole("link", { name: "Abrir" }).click();
  await expect(admin.getByRole("heading", { name: /Maria/ })).toBeVisible();
  await admin.getByRole("button", { name: /Confirmar enquadramento do totem/ }).click();
  await expect(admin.getByText(/Aprove a foto do totem antes de confirmar/)).toBeVisible();

  // pede nova foto do painel, cliente reenvia
  await admin.getByRole("button", { name: "Pedir nova foto" }).nth(1).click();
  await admin.getByLabel(/Motivo/).fill("A borda direita não aparece.");
  await admin.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(admin.getByText("PRECISA_AJUSTE").or(admin.getByText("Precisa de ajuste")).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(/A equipe pediu uma nova foto do painel/)).toBeVisible();
  await page.getByRole("button", { name: "Enviar agora" }).click();
  await expect(page.getByText("A borda direita não aparece.")).toBeVisible();
  await page.locator("input[type=file]").nth(1).setInputFiles({ name: "p2.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText(/A equipe pediu uma nova foto/)).toHaveCount(0);

  // equipe aprova a foto do totem e confirma o enquadramento (só então fica "confirmado")
  await admin.reload();
  await admin.getByRole("button", { name: "Aprovar foto" }).first().click();
  await expect(admin.getByText("Aprovada", { exact: true })).toBeVisible();
  await admin.getByRole("button", { name: /Confirmar enquadramento do totem/ }).click();
  await expect(admin.getByText("Equipe: confirmado")).toBeVisible();
  await admin.getByRole("button", { name: "Ampliar foto" }).first().click();
  await expect(admin.getByRole("dialog")).toBeVisible();
  await admin.getByRole("button", { name: "Fechar" }).click();
});

test("rotas protegidas e dados inválidos", async ({ page, request }) => {
  expect((await request.get("/api/admin/submissions")).status()).toBe(401);
  expect(await (await request.get("/api/submissions/me")).json()).toBeNull();
  expect((await request.post("/api/admin/login", { data: { email: "x@y.com", password: "errada" } })).status()).toBe(401);
  expect((await request.post("/api/submissions", { data: { company: "x" } })).status()).toBe(400);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});
