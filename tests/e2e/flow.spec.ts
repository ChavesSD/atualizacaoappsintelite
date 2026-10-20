import { expect, test, type Page } from "@playwright/test";
import { ACCESS_CODE } from "./global-setup";

// PNG 1x1 válido
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

const next = (p: Page) => p.getByRole("button", { name: /^(Continuar|Concluí esta etapa) →$/ }).click();
const checkAll = async (p: Page) => {
  for (const box of await p.locator("label.check input[type=checkbox]").all()) await box.check();
};

test("cliente completa o fluxo no celular; equipe valida; dashboard reflete", async ({ page, browser }) => {
  // 1) acesso por código (no fragmento da URL)
  await page.goto(`/#${ACCESS_CODE}`);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Identificar a unidade" })).toBeVisible();
  await expect(page.getByText("Unidade Demo Centro").first()).toBeVisible();
  // formato ainda não escolhido: não há seletor
  await expect(page.getByRole("group", { name: "Alternar formato" })).toHaveCount(0);
  await next(page);

  // 2) escolha do formato
  await expect(page.getByRole("heading", { name: "Escolher o formato do tutorial" })).toBeVisible();
  await expect(page.getByText("Siga as instruções passo a passo, com imagens ilustrativas e orientações objetivas.")).toBeVisible();
  await expect(page.getByText("Assista à demonstração e acompanhe o procedimento visualmente, observando cada ação.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar →" })).toBeDisabled();
  await page.screenshot({ path: "test-results/screens/1-formato.png", fullPage: true });
  await page.getByRole("button", { name: /Tutorial em vídeo/ }).click();
  await next(page);

  // 3) atualização do totem — sem vídeo cadastrado, o escrito continua funcionando; alterna sem perder progresso
  await expect(page.getByRole("heading", { name: "Atualizar o totem" })).toBeVisible();
  await expect(page.getByText("Esta etapa ainda não tem vídeo")).toBeVisible();
  await page.getByRole("group", { name: "Alternar formato" }).getByRole("button", { name: /Texto/ }).click();
  await expect(page.getByRole("heading", { name: "Atualizar o totem" })).toBeVisible(); // continua na mesma etapa
  await expect(page.getByText("Esta etapa ainda não tem vídeo")).toHaveCount(0);
  await next(page);

  // 4) enquadramento do totem: problema → instruções → ajuste → nova verificação
  await expect(page.getByRole("heading", { name: "Verificar o enquadramento da tela do totem" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar →" })).toBeDisabled();
  await page.getByRole("button", { name: "Minha tela está cortada ou desalinhada" }).click();
  await page.getByLabel("Texto cortado").check();
  await page.getByRole("button", { name: "Ver instruções de correção" }).click();
  await expect(page.getByText("Ainda não há um procedimento oficial cadastrado")).toBeVisible(); // nada inventado
  await page.screenshot({ path: "test-results/screens/2-correcao.png", fullPage: true });
  await expect(page.getByText("Enquadramento incorreto").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar →" })).toBeDisabled();
  await page.getByRole("button", { name: /Já fiz o ajuste/ }).click();
  await expect(page.getByText("Ajuste realizado, aguardando nova verificação").first()).toBeVisible();
  await checkAll(page);
  await page.getByRole("button", { name: /Está tudo certo na tela do totem/ }).click();
  await expect(page.getByText("Sua confirmação não substitui essa validação")).toBeVisible(); // autodeclaração ≠ validação
  await expect(page.getByText(/Validação técnica da Intelite:\s*pendente/)).toBeVisible();
  await next(page);

  // 5) painel
  await expect(page.getByRole("heading", { name: "Atualizar o painel de chamadas" })).toBeVisible();
  await next(page);
  await expect(page.getByRole("heading", { name: "Verificar o enquadramento da tela do painel" })).toBeVisible();
  await expect(page.getByText("Os números das senhas estão totalmente visíveis.")).toBeVisible();
  await checkAll(page);
  await page.getByRole("button", { name: /Está tudo certo na tela do painel/ }).click();
  await next(page);

  // 6) fotos
  await expect(page.getByRole("heading", { name: "Enviar as fotos dos equipamentos" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar →" })).toBeDisabled();
  const inputs = page.locator("input[type=file]");
  await inputs.nth(0).setInputFiles({ name: "totem.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("Foto do totem enviada")).toBeVisible();
  await inputs.nth(1).setInputFiles({ name: "painel.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("Foto do painel de chamadas enviada")).toBeVisible();
  await next(page);

  // 7) avaliação
  await expect(page.getByRole("heading", { name: "Confirmação e avaliação" })).toBeVisible();
  await page.getByRole("radio", { name: "5 de 5" }).click();
  await page.getByRole("button", { name: "Enviar confirmação e avaliação" }).click();
  await expect(page.getByText("Recebemos a sua confirmação")).toBeVisible();
  await expect(page.getByText(/equipe técnica da Intelite vai analisar as fotos/)).toBeVisible(); // ainda NÃO concluída operacionalmente

  // progresso persistido: recarregar mantém a etapa
  await page.reload();
  await expect(page.getByRole("heading", { name: "Confirmação e avaliação" })).toBeVisible();

  // 8) equipe técnica
  const admin = await (await browser.newContext({ baseURL: "http://localhost:3200" })).newPage();
  await admin.goto("/admin/login");
  await admin.getByLabel("E-mail").fill("tecnico@intelite.local");
  await admin.getByLabel("Senha").fill("senha-e2e-123456");
  await admin.getByRole("button", { name: "Entrar" }).click();
  await expect(admin.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await admin.goto("/admin/unidades");
  await expect(admin.getByText("Aguardando validação técnica")).toBeVisible();
  await admin.getByRole("row", { name: /Unidade Demo Centro/ }).getByRole("link", { name: "Abrir" }).click();
  await expect(admin.getByRole("heading", { name: "Unidade Demo Centro" })).toBeVisible();

  // não valida sem antes aceitar uma foto
  await admin.getByRole("button", { name: "Validar enquadramento" }).first().click();
  await expect(admin.getByText(/aceite ao menos uma fotografia/)).toBeVisible();

  // foto ampliável
  await admin.getByRole("button", { name: "Ampliar foto" }).first().click();
  await expect(admin.getByRole("dialog")).toBeVisible();
  await admin.getByRole("button", { name: "Fechar" }).click();

  for (let i = 0; i < 2; i++) {
    await admin.getByRole("button", { name: "Aceitar foto", disabled: false }).first().click();
    await expect(admin.getByText("Aceita", { exact: true }).nth(i)).toBeVisible();
  }
  for (let i = 0; i < 2; i++) {
    await admin.getByRole("button", { name: "Validar enquadramento" }).nth(i).click();
    await expect(admin.getByText("Validação técnica: validado")).toHaveCount(i + 1);
  }
  await expect(admin.getByText("Concluída operacionalmente")).toBeVisible();
  await admin.screenshot({ path: "test-results/screens/4-admin-unidade.png", fullPage: true });

  // 9) dashboard a partir dos registros reais
  await admin.goto("/admin");
  const kpi = (label: string) => admin.locator(".kpi", { hasText: label }).locator(".n");
  await expect(kpi("Totens com enquadramento confirmado")).toHaveText("1");
  await expect(kpi("Painéis com enquadramento confirmado")).toHaveText("1");
  await expect(kpi("Escolheram vídeo")).toHaveText("1");
  await expect(kpi("Trocaram de formato")).toHaveText("1");
  await expect(admin.getByText("Texto cortado").first()).toBeVisible();
  await admin.screenshot({ path: "test-results/screens/5-dashboard.png", fullPage: true });
});

test("o código inválido é recusado e rotas protegidas exigem autenticação", async ({ page, request }) => {
  await page.goto("/");
  await page.getByLabel("Código da unidade").fill("ZZZZZ-99999");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("Código não encontrado")).toBeVisible();

  expect((await request.get("/api/admin/dashboard")).status()).toBe(401);
  expect((await request.get("/api/client/session")).status()).toBe(401);
  expect((await request.post("/api/admin/login", { data: { email: "x@y.com", password: "errada" } })).status()).toBe(401);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto("/tutorial");
  await expect(page).toHaveURL(/\/$/);
});
