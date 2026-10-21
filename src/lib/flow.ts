/** Fluxo único do tutorial. A ordem e as chaves são fixas; o TEXTO de cada etapa é editável no admin (tabela Step). */
export const STEPS = [
  { key: "dados", title: "Seus dados" },
  { key: "formato", title: "Formato do tutorial" },
  { key: "atualizar-totem", title: "Atualizar o totem" },
  { key: "enquadramento-totem", title: "Conferir a tela do totem" },
  { key: "atualizar-painel", title: "Atualizar o painel" },
  { key: "enquadramento-painel", title: "Conferir a tela do painel" },
  { key: "fotos", title: "Fotos" },
  { key: "enviar", title: "Enviar" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];
export const stepIndex = (key: string) => STEPS.findIndex((s) => s.key === key);

/** Conteúdo exibido quando o cliente indica problema na tela (editável no admin). */
export const FIX_KEYS = { TOTEM: "correcao-totem", PAINEL: "correcao-painel" } as const;

export const CRITERIA = {
  TOTEM: [
    "Todos os elementos da interface estão visíveis.",
    "Textos, botões e logotipo não estão cortados.",
    "A interface está centralizada e bem posicionada.",
    "O conteúdo ocupa bem a área útil da tela.",
    "Não há barras, margens ou espaços inesperados.",
    "Os botões aparecem inteiros e podem ser usados normalmente.",
  ],
  PAINEL: [
    "Os números das senhas estão totalmente visíveis.",
    "Os nomes ou identificações dos atendimentos não estão cortados.",
    "Os elementos estão bem posicionados.",
    "Não há informações importantes fora da área visível.",
    "O layout mantém a proporção adequada ao monitor.",
  ],
} as const;

export const ISSUES = {
  TOTEM: ["Texto cortado", "Botão cortado", "Logotipo cortado", "Interface deslocada", "Barras ou margens", "Conteúdo fora da área visível", "Proporção incorreta", "Outro"],
  PAINEL: ["Senha cortada", "Identificação cortada", "Interface deslocada", "Conteúdo fora da área visível", "Proporção incorreta", "Barras ou margens", "Outro"],
} as const;

export const FRAMING_LABEL = {
  NAO_VERIFICADO: "Não verificado",
  CORRETO: "Correto",
  INCORRETO: "Incorreto",
  PRECISA_SUPORTE: "Precisa de suporte",
} as const;

export const STATUS_LABEL = {
  EM_ANDAMENTO: "Em andamento",
  ENVIADO: "Enviado, aguardando equipe",
  APROVADO: "Aprovado",
  PRECISA_AJUSTE: "Precisa de ajuste",
} as const;

/** Textos iniciais. Os passos de atualização NÃO são inventados: ficam como pendentes até a equipe técnica cadastrar. */
const PENDENTE = "O procedimento oficial desta etapa ainda não foi cadastrado pela equipe da Intelite.";
const PENDENTE_AVISO = "Não faça ajustes por conta própria. Use “Preciso de ajuda” se precisar avançar.";

export const DEFAULT_CONTENT: Record<string, { title: string; instructions: string; warning?: string }> = {
  formato: { title: "Formato do tutorial", instructions: "Escolha como prefere acompanhar: por escrito ou em vídeo.\nVocê pode trocar a qualquer momento sem perder o que já fez." },
  "atualizar-totem": { title: "Atualizar o totem", instructions: PENDENTE, warning: PENDENTE_AVISO },
  "enquadramento-totem": { title: "Conferir a tela do totem", instructions: "Olhe para a tela inteira do totem, de frente, com o Atendimento Inteligente aberto.\nConfirme cada item abaixo somente se estiver realmente correto." },
  "correcao-totem": { title: "Minha tela do totem está cortada ou desalinhada", instructions: PENDENTE, warning: "Não altere configurações que não estejam nas instruções oficiais." },
  "atualizar-painel": { title: "Atualizar o painel de chamadas", instructions: PENDENTE, warning: PENDENTE_AVISO },
  "enquadramento-painel": { title: "Conferir a tela do painel", instructions: "Olhe para a tela inteira do painel de chamadas exibindo o Atendimento Inteligente.\nConfirme cada item abaixo somente se estiver realmente correto." },
  "correcao-painel": { title: "Minha tela do painel está cortada ou desalinhada", instructions: PENDENTE, warning: "Não altere configurações que não estejam nas instruções oficiais." },
  fotos: { title: "Fotos dos equipamentos", instructions: "Fotografe a tela inteira de cada equipamento, de frente.\nMostre as bordas da tela e a interface completa, sem cortar nenhum canto.\nEvite reflexos.", warning: "A equipe usa a foto para avaliar o enquadramento. Uma foto cortada pode ser recusada." },
};
