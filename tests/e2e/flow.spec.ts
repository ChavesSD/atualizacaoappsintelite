import { expect, test, type Page } from "@playwright/test";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const next = (p: Page) => p.getByRole("button", { name: "Continuar →" }).click();
const head = (p: Page, name: string) => p.getByRole("button", { name: new RegExp(name) });

test("downloads dos aplicativos: opções, download direto com Range e links editáveis", async ({ request }) => {
  const list = await (await request.get("/api/downloads")).json();
  const totem = list.find((x: { app: string }) => x.app === "totem");
  expect(totem.links).toEqual(["https://bit.ly/aitotem26", "https://shre.ink/aitotem26"]);
  expect(totem.direct).toBe("/api/download/totem");
  expect(totem.sizeBytes).toBeGreaterThan(1_000_000);

  const full = await request.get("/api/download/totem");
  expect(full.status()).toBe(200);
  expect(full.headers()["content-type"]).toBe("application/vnd.android.package-archive");
  expect(full.headers()["content-disposition"]).toContain('filename="AI_Totem_26.10.apk"');
  expect(full.headers()["accept-ranges"]).toBe("bytes");
  const body = await full.body();
  expect(body.length).toBe(totem.sizeBytes);
  expect(body.subarray(0, 2).toString()).toBe("PK"); // APK é um ZIP

  // retomar download: Range
  const part = await request.get("/api/download/painel", { headers: { Range: "bytes=0-3" } });
  expect(part.status()).toBe(206);
  expect(part.headers()["content-range"]).toMatch(/^bytes 0-3\/\d+$/);
  expect((await part.body()).toString()).toBe("PK\u0003\u0004");
  expect((await request.get("/api/download/painel", { headers: { Range: "bytes=999999999-" } })).status()).toBe(416);
  expect((await request.get("/api/download/outro")).status()).toBe(404);

  // links editáveis só pelo admin, somente https
  expect((await request.put("/api/admin/settings", { data: { downloadLinks: { totem: [], painel: [] } } })).status()).toBe(401);
  const login = await request.post("/api/admin/login", { data: { email: "admin@intelite.local", password: "senha-e2e-123456" } });
  expect(login.status()).toBe(200);
  expect((await request.put("/api/admin/settings", { data: { downloadLinks: { totem: ["http://inseguro.com/x"], painel: [] } } })).status()).toBe(400);
  const ok = await request.put("/api/admin/settings", { data: { downloadLinks: { totem: ["bit.ly/novo-totem"], painel: ["bit.ly/aipainel26"] } } });
  expect(ok.status()).toBe(200);
  expect((await (await request.get("/api/downloads")).json()).find((x: { app: string }) => x.app === "totem").links).toEqual(["https://bit.ly/novo-totem"]);
  // restaura os padrões para não afetar os demais testes
  await request.put("/api/admin/settings", { data: { downloadLinks: { totem: ["bit.ly/aitotem26", "shre.ink/aitotem26"], painel: ["bit.ly/aipainel26", "shre.ink/aipainel26"] } } });
});

test("página única em sanfona: cliente conclui no celular; equipe confirma; indicadores refletem", async ({ page, browser }) => {
  await page.goto("/");
  await expect(page.getByAltText("Intelite Tecnologia").first()).toBeVisible();
  await expect(page.getByText("na ordem")).toBeVisible();

  // etapas posteriores ficam bloqueadas até concluir as anteriores
  await expect(head(page, "Formato do tutorial")).toBeDisabled();
  await expect(head(page, "Enviar as fotos")).toBeDisabled();
  await expect(page.getByLabel("E-mail")).toHaveCount(0); // só nome e empresa
  await page.getByLabel("Seu nome").fill("Maria");
  await page.getByLabel("Nome da empresa").fill("Empresa Teste");
  await page.getByRole("button", { name: "Começar" }).click();

  // formato (sanfona abre sozinha na etapa atual; só uma aberta por vez)
  await expect(head(page, "Formato do tutorial")).toHaveAttribute("aria-expanded", "true");
  await expect(head(page, "Atualizar o totem")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Continuar →" })).toBeDisabled();
  await page.getByRole("button", { name: /Tutorial em vídeo/ }).click();
  await next(page);

  // totem — conteúdo oficial, troca de formato sem perder a etapa
  await expect(head(page, "Atualizar o totem")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Remover a versão anterior")).toBeVisible();
  await expect(page.getByRole("link", { name: /bit\.ly\/aitotem26/ })).toBeVisible(); // opção 1
  await expect(page.getByRole("link", { name: /shre\.ink\/aitotem26/ })).toBeVisible(); // opção 2
  await expect(page.getByRole("link", { name: /Baixar direto desta página/ })).toBeVisible(); // opção 3
  await expect(page.getByText("Esta etapa ainda não tem vídeo")).toBeVisible();
  await page.getByRole("group", { name: "Alternar formato" }).getByRole("button", { name: /Texto/ }).click();
  await expect(page.getByText("Esta etapa ainda não tem vídeo")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Continuar →" })).toBeDisabled();
  await page.getByLabel(/Concluí a atualização do totem/).click();
  await expect(page.getByLabel(/Concluí a atualização do totem/)).toBeChecked();
  await next(page);

  // enquadramento do totem: problema → instruções → conferir de novo
  await expect(head(page, "Conferir a tela do totem")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Continuar →" })).toBeDisabled();
  // lista informativa: nada para marcar
  await expect(page.getByText("O que precisa estar correto na tela do totem")).toBeVisible();
  await expect(page.getByText("Os botões aparecem inteiros e podem ser usados normalmente.")).toBeVisible();
  await expect(page.locator(".acc-body input[type=checkbox]")).toHaveCount(0);
  await page.getByRole("button", { name: "Minha tela está cortada ou desalinhada" }).click(); // vai direto ao tutorial de ajuste
  await expect(page.getByText("Ajuste necessário")).toBeVisible();
  await expect(page.getByText("Ainda não temos um ajuste padrão para a tela do totem")).toBeVisible(); // sem ajuste técnico inventado: orienta a pedir suporte
  await expect(page.getByRole("button", { name: "Continuar →" })).toBeDisabled();
  await page.getByRole("button", { name: /Já fiz o ajuste/ }).click();
  await page.getByRole("button", { name: /Está tudo certo na tela do totem/ }).click();
  await expect(page.getByText(/Sua confirmação será conferida pela equipe/)).toBeVisible(); // declarado ≠ confirmado
  await next(page);

  // painel: atualização → conferência
  await expect(head(page, "Atualizar o painel")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Remover a versão anterior")).toBeVisible();
  await expect(page.getByRole("link", { name: /shre\.ink\/aipainel26/ })).toBeVisible();
  await expect(page.getByText("Síntese de Voz")).toHaveCount(0); // etapa retirada
  await expect(head(page, "Conferir a tela do painel")).toBeDisabled();
  await page.getByLabel(/Concluí a atualização do painel/).click();
  await expect(page.getByLabel(/Concluí a atualização do painel/)).toBeChecked();
  await next(page);
  await expect(head(page, "Conferir a tela do painel")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Os números das senhas estão totalmente visíveis.")).toBeVisible();
  await page.getByRole("button", { name: "Minha tela está cortada ou desalinhada" }).click();
  await expect(page.getByText("Ajustar a proporção da tela (TV Box SmartPRO)")).toBeVisible(); // tutorial de ajuste do painel
  await page.getByRole("button", { name: /Já fiz o ajuste/ }).click();
  await page.getByRole("button", { name: /Está tudo certo na tela do painel/ }).click();
  await next(page);

  // fotos
  await expect(head(page, "Enviar as fotos")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Continuar →" })).toBeDisabled();
  await page.locator("input[type=file]").nth(0).setInputFiles({ name: "t.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("Foto do totem enviada")).toBeVisible();
  await page.locator("input[type=file]").nth(1).setInputFiles({ name: "p.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByAltText("Foto do painel de chamadas enviada")).toBeVisible();
  await next(page);

  // enviar
  await expect(head(page, "Confirmar e avaliar")).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("radio", { name: "5 de 5" }).click();
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Recebemos o seu envio")).toBeVisible();
  await expect(page.getByText("8 de 8 etapas concluídas")).toBeVisible();

  // pedido de ajuda
  await page.getByRole("button", { name: "Preciso de ajuda" }).click();
  await page.getByLabel("Descrição do problema").fill("Não achei o botão");
  await page.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(page.getByText("Pedido enviado.")).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  // retomar: recarregar mantém o progresso (cookie) e reabre a etapa atual
  await page.reload();
  await expect(head(page, "Confirmar e avaliar")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Recebemos o seu envio")).toBeVisible();

  // admin
  const admin = await (await browser.newContext({ baseURL: "http://localhost:3200" })).newPage();
  await admin.goto("/admin/login");
  await expect(admin.getByAltText("Intelite Tecnologia").first()).toBeVisible();
  await admin.getByLabel("E-mail").fill("admin@intelite.local");
  await admin.getByLabel("Senha").fill("senha-e2e-123456");
  await admin.getByRole("button", { name: "Entrar" }).click();
  await expect(admin.getByRole("heading", { name: "Envios" })).toBeVisible();
  await expect(admin.locator(".kpi", { hasText: "Aguardando a equipe" }).locator(".n")).toHaveText("1");
  await expect(admin.locator(".kpi", { hasText: "Totens confirmados" }).locator(".n")).toHaveText("0"); // declarado ≠ confirmado
  await expect(admin.locator(".kpi", { hasText: "Pedidos de ajuda em aberto" }).locator(".n")).toHaveText("1");

  // exportação CSV
  const csv = await admin.request.get("/api/admin/export");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const body = await csv.text();
  expect(body).toContain("Empresa Teste");
  expect(body).not.toContain("Síntese de Voz");

  await admin.getByRole("link", { name: "Abrir" }).click();
  await expect(admin.getByRole("heading", { name: /Maria/ })).toBeVisible();
  await admin.getByRole("button", { name: /Confirmar enquadramento do totem/ }).click();
  await expect(admin.getByText(/Aprove a foto do totem antes de confirmar/)).toBeVisible();

  // pedido de ajuda: aparece e é marcado como atendido
  await expect(admin.locator(".alert strong", { hasText: "Pediu ajuda" })).toBeVisible();
  await admin.getByRole("button", { name: "Marcar como atendido" }).click();
  await expect(admin.getByText("Pedido de ajuda atendido")).toBeVisible();

  // pede nova foto do painel; o cliente é avisado e reenvia
  await admin.getByRole("button", { name: "Pedir nova foto" }).nth(1).click();
  await admin.getByLabel(/Motivo/).fill("A borda direita não aparece.");
  await admin.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(admin.getByText("Precisa de ajuste").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(/A equipe pediu uma nova foto do painel/)).toBeVisible();
  await page.getByRole("button", { name: "Enviar agora" }).click();
  await expect(page.getByText("A borda direita não aparece.")).toBeVisible();
  await page.locator("input[type=file]").nth(1).setInputFiles({ name: "p2.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByText(/A equipe pediu uma nova foto/)).toHaveCount(0);

  // aprova a foto do totem e confirma (só então "confirmado")
  await admin.reload();
  await admin.getByRole("button", { name: "Aprovar foto" }).first().click();
  await expect(admin.getByText("Aprovada", { exact: true })).toBeVisible();
  await admin.getByRole("button", { name: /Confirmar enquadramento do totem/ }).click();
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
  await admin.getByLabel("Senha atual").fill("senha-e2e-123456");
  await admin.getByLabel("Nova senha (mín. 10 caracteres)").fill("outra-senha-e2e-9876");
  await admin.getByLabel("Repita a nova senha").fill("outra-senha-e2e-9876");
  await admin.getByRole("button", { name: "Salvar" }).click();
  await expect(admin.getByText("Senha alterada.")).toBeVisible();

  // excluir o envio (LGPD)
  await admin.goto("/admin");
  await admin.getByRole("link", { name: "Abrir" }).click();
  admin.once("dialog", (d) => d.accept());
  await admin.getByRole("button", { name: "Excluir envio" }).click();
  await expect(admin.getByRole("heading", { name: "Envios" })).toBeVisible();
  await expect(admin.getByText("Nenhum envio encontrado.")).toBeVisible();
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
