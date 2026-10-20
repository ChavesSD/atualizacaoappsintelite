import { PrismaClient, type Prisma } from "@prisma/client";
import { STEP_FLOW } from "../src/domain/steps";
import { generateAccessCode, hashAccessCode, hashPassword } from "../src/lib/crypto";

const db = new PrismaClient();

/**
 * Conteúdo inicial. IMPORTANTE: o procedimento oficial de atualização de cada aplicativo e os parâmetros de
 * correção (resolução, DPI, escala...) NÃO são inventados aqui. As etapas de atualização entram com um aviso
 * explícito e devem ser preenchidas/publicadas pela equipe técnica em /admin/conteudo.
 */
const PENDENTE = [
  {
    text: "O procedimento oficial de atualização desta etapa ainda não foi cadastrado pela equipe técnica da Intelite.",
    warning: "Não execute ajustes por conta própria. Se precisar avançar agora, use “Preciso de ajuda” para falar com o suporte.",
  },
];
const CONTENT: Record<string, { text: string; warning?: string; highlight?: string }[]> = {
  identificacao: [
    { text: "Confira se o nome e o código exibidos acima correspondem à sua unidade." },
    { text: "Se algo estiver diferente, use “Preciso de ajuda” antes de continuar.", warning: "Não prossiga com os dados de outra unidade." },
  ],
  formato: [
    { text: "Escolha como prefere acompanhar: por escrito ou em vídeo." },
    { text: "Você pode trocar de formato a qualquer momento, sem perder o que já concluiu." },
  ],
  "atualizar-totem": PENDENTE,
  "atualizar-painel": PENDENTE,
  "enquadramento-totem": [
    { text: "Observe a tela inteira do totem, de frente, com a interface do Atendimento Inteligente aberta." },
    { text: "Marque cada item abaixo somente se estiver realmente correto na tela." },
    { text: "Se algo estiver cortado ou deslocado, indique o problema: você receberá as instruções de correção aprovadas pela Intelite.", warning: "Não altere configurações que não constem nas instruções oficiais." },
  ],
  "enquadramento-painel": [
    { text: "Observe a tela inteira do painel de chamadas exibindo a interface do Atendimento Inteligente." },
    { text: "Marque cada item abaixo somente se estiver realmente correto na tela." },
    { text: "Se algo estiver cortado ou deslocado, indique o problema: você receberá as instruções de correção aprovadas pela Intelite.", warning: "Não altere configurações que não constem nas instruções oficiais." },
  ],
  fotos: [
    { text: "Fotografe a tela inteira de cada equipamento, de frente, mostrando as bordas da tela e a interface completa." },
    { text: "Evite reflexos e não corte nenhum canto da imagem: a equipe usa a foto para avaliar o enquadramento.", warning: "Uma foto que não permita ver a área útil da tela pode ser recusada." },
  ],
  avaliacao: [{ text: "Revise o resumo, avalie sua experiência e conte onde sentiu mais dificuldade." }],
};

const CRITERIA: Record<"TOTEM" | "PAINEL", string[]> = {
  TOTEM: [
    "Todos os elementos relevantes da interface estão visíveis.",
    "Textos, botões, logotipo e demais componentes não estão cortados.",
    "A interface está centralizada e posicionada corretamente.",
    "O conteúdo ocupa adequadamente a área útil da tela.",
    "Não há barras, margens ou espaços inesperados que prejudiquem o uso.",
    "Os botões e elementos interativos estão visíveis e podem ser usados normalmente.",
  ],
  PAINEL: [
    "Os números das senhas estão totalmente visíveis.",
    "Os nomes ou identificações dos atendimentos não estão cortados.",
    "Os elementos estão posicionados corretamente.",
    "Não há informações importantes fora da área visível.",
    "O layout mantém a proporção adequada para o monitor utilizado.",
  ],
};

async function main() {
  for (const s of STEP_FLOW) {
    const step = await db.tutorialStep.upsert({
      where: { key: s.key },
      update: { position: s.position, title: s.title, kind: s.kind, type: s.type ?? null, required: s.required },
      create: { key: s.key, position: s.position, title: s.title, kind: s.kind, type: s.type, required: s.required },
    });
    const has = await db.stepContent.count({ where: { stepId: step.id } });
    if (!has) {
      await db.stepContent.create({
        data: { stepId: step.id, version: 1, status: "PUBLICADO", publishedAt: new Date(), hasText: true, hasVideo: false, recommendedFormat: "TEXTO", instructions: CONTENT[s.key] as Prisma.InputJsonValue },
      });
    }
  }

  for (const type of ["TOTEM", "PAINEL"] as const) {
    if (await db.framingCriterion.count({ where: { type } })) continue;
    await db.framingCriterion.createMany({ data: CRITERIA[type].map((label, i) => ({ type, label, position: i })) });
  }

  const adminPw = process.env.SEED_ADMIN_PASSWORD ?? "trocar-esta-senha-123";
  for (const [email, name, role] of [
    ["admin@intelite.local", "Administrador", "ADMIN"],
    ["tecnico@intelite.local", "Equipe Técnica", "TECNICO"],
  ] as const) {
    await db.adminUser.upsert({ where: { email }, update: {}, create: { email, name, role, passwordHash: hashPassword(adminPw) } });
  }
  console.log(`Administradores: admin@intelite.local e tecnico@intelite.local (senha: ${process.env.SEED_ADMIN_PASSWORD ? "definida por SEED_ADMIN_PASSWORD" : adminPw}) — TROQUE em produção.`);

  if (process.env.NODE_ENV !== "production" && !(await db.campaign.count())) {
    const camp = await db.campaign.create({ data: { name: "Atualização de demonstração", startsAt: new Date() } });
    for (const [code, name, city] of [["DEMO-01", "Unidade Demo Centro", "São Paulo"], ["DEMO-02", "Unidade Demo Norte", "Campinas"], ["DEMO-03", "Unidade Demo Sul", "Curitiba"]] as const) {
      const unit = await db.unit.create({ data: { code, name, city } });
      const accessCode = code === "DEMO-01" && process.env.SEED_FIXED_ACCESS_CODE ? process.env.SEED_FIXED_ACCESS_CODE : generateAccessCode();
      await db.campaignUnit.create({ data: { campaignId: camp.id, unitId: unit.id, accessCodeHash: hashAccessCode(accessCode) } });
      console.log(`Código de acesso de ${name}: ${accessCode}`);
    }
  }
}

main().finally(() => db.$disconnect());
