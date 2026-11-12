/**
 * Fluxo único do tutorial. Um só aplicativo (híbrido) atende totem e painel de chamadas, então não há caminhos separados.
 * Depois de escolher a solução e informar nome e empresa, o cliente passa por quatro fases, nesta ordem.
 * O TEXTO de cada fase é editável no admin (tabela Step).
 */
export const STEPS = [
  { key: "atualizar", title: "Atualizar o aplicativo", short: "Atualizar" },
  { key: "conferir", title: "Conferir a tela", short: "Conferir" },
  { key: "fotos", title: "Enviar uma foto", short: "Foto" },
  { key: "enviar", title: "Finalizar", short: "Finalizar" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];
export const stepIndex = (key: string) => STEPS.findIndex((s) => s.key === key);

/** Soluções disponíveis na abertura da página. Hoje só existe uma; para incluir outra, basta acrescentar aqui. */
export const SOLUTIONS = [
  { id: "atendimento-inteligente", name: "Atendimento Inteligente", description: "Totem de autoatendimento e painel de chamadas" },
] as const;
export const DEFAULT_SOLUTION: string = SOLUTIONS[0].id;
export const isSolution = (id: string) => SOLUTIONS.some((s) => s.id === id);

/** Conteúdo exibido quando o cliente indica problema na tela (editável no admin). */
export const FIX_KEY = "correcao";

/** O que precisa estar correto na tela do equipamento (totem ou painel). */
export const CRITERIA = [
  "Todos os elementos da interface estão visíveis.",
  "Textos, botões, logotipo e números das senhas não estão cortados.",
  "A interface está centralizada e ocupa bem a área útil da tela.",
  "Não há barras, margens ou espaços inesperados.",
  "Os botões aparecem inteiros e podem ser usados normalmente.",
] as const;

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


/** Textos iniciais. O aplicativo é o mesmo para totem e painel; a atualização é feita por cima da versão instalada. */
export const PENDENTE = "O procedimento oficial desta etapa ainda não foi cadastrado pela equipe da Intelite.";

export const DEFAULT_CONTENT: Record<string, { title: string; instructions: string; warning?: string }> = {
  atualizar: {
    title: "Atualizar o aplicativo",
    instructions: [
      "## Prepare o Mini PC",
      "Ligue o Mini PC e confirme que ele está conectado à internet.",
      "Conecte um mouse USB para facilitar. Se preferir, use o controle remoto.",
      "Abra o **Google Chrome**.",
      "## Baixe o aplicativo",
      "No Chrome do Mini PC, baixe o aplicativo por uma destas opções. Se uma não funcionar, use outra.",
      "[[downloads]]",
      "Se o Chrome pedir acesso ao armazenamento, toque em **Continuar** e depois em **Permitir**.",
      "Quando o download terminar, toque em **Abrir** no aviso que aparece na parte de baixo da tela.",
      "## Instale por cima da versão atual",
      "Você não precisa desinstalar nada: o novo aplicativo atualiza o que já está no Mini PC, sem perder os dados.",
      "Na primeira vez, o Android avisa que o Chrome não tem permissão para instalar aplicativos de fontes desconhecidas. Toque em **Configurações**, ative a chave do **Chrome** e volte.",
      "Abra o arquivo baixado de novo: menu do Chrome (três pontinhos), **Downloads** e toque no arquivo. Se aparecer o aviso de fontes desconhecidas, toque em **Aceitar**.",
      "Quando o Android perguntar se quer instalar uma atualização, toque em **Instalar** e aguarde. Quando aparecer “App instalado”, toque em **Abrir**.",
      "## Abra e aguarde carregar",
      "Na primeira abertura, o aplicativo mostra o MAC do equipamento e a versão instalada.",
      "Se perguntar se deve abrir sozinho ao ligar, toque em **Agora não** ou espere alguns segundos.",
      "Quando pedir acesso a fotos e mídia, toque em **Permitir**. O aplicativo baixa o conteúdo e mostra o andamento: aguarde até o conteúdo começar a rodar.",
      "Se o aplicativo avisar que o equipamento ainda não está cadastrado, anote o MAC que aparece na tela e avise a equipe da Intelite.",
      "Confirme que o aplicativo abre normalmente e que as informações aparecem corretamente.",
    ].join("\n"),
    warning: "Tem totem e painel de chamadas? O aplicativo é o mesmo: repita estes passos em cada Mini PC.",
  },
  conferir: {
    title: "Conferir a tela",
    instructions: [
      "Olhe para a tela inteira do equipamento, de frente, com o Atendimento Inteligente aberto.",
      "Todos os itens da lista abaixo precisam estar corretos na tela. Se algum não estiver, siga o tutorial de ajuste.",
    ].join("\n"),
  },
  [FIX_KEY]: {
    title: "Minha tela está cortada ou desalinhada",
    instructions: [
      "## Ajustar a proporção da tela (TV Box SmartPRO)",
      "[[video:ajustar]]",
      "No controle remoto, pressione **Home** e abra **Configurações**.",
      "Entre em **Preferências do dispositivo**.",
      "Selecione **Exibição**.",
      "Acesse **Ajuste de proporção de tela**.",
      "Com as setas do controle remoto, ajuste as bordas da imagem.",
      "Reduza a área de exibição aos poucos, até as bordas pretas começarem a aparecer nas laterais e na parte de baixo da tela.",
      "Faça pequenos ajustes até toda a imagem ficar visível, sem cortes nas extremidades.",
    ].join("\n"),
    warning: "O objetivo é que todo o conteúdo fique visível, sem partes cortadas nas bordas do monitor ou painel.",
  },
  fotos: {
    title: "Enviar uma foto",
    instructions: [
      "Fotografe a tela inteira do equipamento, de frente.",
      "Mostre as bordas da tela e a interface completa, sem cortar nenhum canto.",
      "Evite reflexos.",
      "Tem totem e painel? Envie uma foto de cada um.",
    ].join("\n"),
    warning: "A equipe usa a foto para avaliar o enquadramento. Uma foto cortada pode ser recusada.",
  },
};

/**
 * Textos padrão de versões anteriores. Se o banco ainda tiver EXATAMENTE um destes (ninguém editou no admin), a etapa é
 * atualizada para o texto atual no próximo deploy; qualquer edição da equipe é preservada.
 * Ao mudar um texto padrão acima, acrescente aqui a versão que ele substitui.
 */
export const PREVIOUS_DEFAULTS: Record<string, string[]> = {
  atualizar: [
    [

      "## Prepare o Mini PC",
      "Ligue o Mini PC e confirme que ele está conectado à internet.",
      "Conecte um mouse USB para facilitar. Se preferir, use o controle remoto.",
      "Abra o **Google Chrome**.",
      "## Baixe o aplicativo",
      "No Chrome do Mini PC, baixe o aplicativo por uma destas opções. Se uma não funcionar, use outra.",
      "[[downloads]]",
      "Se o Chrome avisar que esse tipo de arquivo pode danificar o dispositivo, escolha manter o arquivo (**OK** ou **Manter**).",
      "Se o Chrome pedir acesso ao armazenamento, clique em **Continuar** e depois em **Permitir**.",
      "## Instale por cima da versão atual",
      "Você não precisa desinstalar nada: o novo aplicativo atualiza o que já está no Mini PC, sem perder os dados.",
      "Quando o download terminar, clique em **Abrir** (ou abra o arquivo pelo gerenciador de arquivos).",
      "Se o Android avisar sobre aplicativos de fontes desconhecidas, clique em **Configurações**, ligue a chave do aplicativo de onde você abriu o arquivo, volte e clique em **Aceitar**.",
      "Clique em **Instalar** e aguarde. Quando aparecer “App instalado”, clique em **Abrir**.",
      "## Abra e aguarde carregar",
      "Na primeira abertura, o aplicativo carrega e mostra a versão instalada na tela.",
      "Se forem solicitadas permissões, conceda todas.",
      "Se o aplicativo avisar que o equipamento ainda não está cadastrado, anote o código (MAC) que aparece na tela e avise a equipe da Intelite.",
      "Confirme que o aplicativo abre normalmente e que as informações aparecem corretamente.",
    ].join("\n"),
    [
      "## Prepare o Mini PC",
      "Ligue o Mini PC e confirme que ele está conectado à internet.",
      "Conecte um mouse USB para facilitar. Se preferir, use o controle remoto.",
      "Abra o **Google Chrome**.",
      "## Baixe o aplicativo",
      "No Chrome do Mini PC, baixe o aplicativo por uma destas opções. Se uma não funcionar, use outra.",
      "[[downloads]]",
      "Se abrir a página do Google Drive, clique em **Download** e, no aviso de vírus, em **Fazer o download mesmo assim**.",
      "Se o Chrome pedir acesso ao armazenamento, clique em **Continuar** e depois em **Permitir**.",
      "## Instale por cima da versão atual",
      "Você não precisa desinstalar nada: o novo aplicativo atualiza o que já está no Mini PC.",
      "Quando o download terminar, clique em **Abrir**. Se for solicitado, permita a instalação de aplicativos de fontes desconhecidas.",
      "Clique em **Instalar** e aguarde. Quando aparecer “App instalado”, clique em **Abrir**.",
      "## Abra e aguarde carregar",
      "Na primeira abertura, o aplicativo baixa o conteúdo e mostra o andamento até chegar a 100%.",
      "Se forem solicitadas permissões, conceda todas.",
      "Confirme que o aplicativo abre normalmente e que as informações aparecem corretamente.",
    ].join("\n"),
  ],
};
