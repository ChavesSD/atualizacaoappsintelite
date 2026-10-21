/** Fluxo único do tutorial. A ordem e as chaves são fixas; o TEXTO de cada etapa é editável no admin (tabela Step). */
export const STEPS = [
  { key: "dados", title: "Seus dados", group: "Início" },
  { key: "formato", title: "Formato do tutorial", group: "Início" },
  { key: "atualizar-totem", title: "Atualizar o totem", group: "Totem" },
  { key: "enquadramento-totem", title: "Conferir a tela do totem", group: "Totem" },
  { key: "atualizar-painel", title: "Atualizar o painel", group: "Painel de chamadas" },
  { key: "enquadramento-painel", title: "Conferir a tela do painel", group: "Painel de chamadas" },
  { key: "fotos", title: "Enviar as fotos", group: "Conclusão" },
  { key: "enviar", title: "Confirmar e avaliar", group: "Conclusão" },
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
export const PENDENTE = "O procedimento oficial desta etapa ainda não foi cadastrado pela equipe da Intelite.";
const PENDENTE_AVISO = "Não faça ajustes por conta própria: aguarde o procedimento oficial.";

export const DEFAULT_CONTENT: Record<string, { title: string; instructions: string; warning?: string }> = {
  formato: { title: "Formato do tutorial", instructions: "Escolha como prefere acompanhar: por escrito ou em vídeo.\nVocê pode trocar a qualquer momento sem perder o que já fez." },
  "atualizar-totem": { title: "Atualizar o totem", instructions: "## Remover a versão anterior\n[[video:remover]]\nConecte um mouse USB ao Mini PC.\nVolte à tela inicial: no controle remoto, pressione **Home**; ou, no mouse, clique 3 a 4 vezes com o botão direito.\nAbra **Configurações** e entre em **Apps**.\nToque em **Mostrar apps do sistema** para listar todos os aplicativos.\nLocalize o aplicativo **AI_AutoAtendimento** (versão anterior do totem) e abra-o.\nClique em **Desinstalar** e confirme com **OK**. Aguarde a conclusão.\n## Instalar a nova versão\n[[video:instalar]]\nAbra o **Google Chrome** no Mini PC e baixe o aplicativo por uma destas opções. Se uma não funcionar, use outra.\n[[downloads:totem]]\nSe abrir a página do Google Drive, clique em **Download** e, no aviso de vírus, em **Fazer o download mesmo assim**.\nSe o Chrome pedir acesso ao armazenamento, clique em **Continuar** e depois em **Permitir**.\nQuando o download terminar, clique em **Abrir**. Se for solicitado, permita a instalação de aplicativos de fontes desconhecidas.\nClique em **Instalar** e aguarde. Quando aparecer “App instalado”, clique em **Abrir**.\n## Conferir o funcionamento\nAguarde o aplicativo carregar. Na primeira abertura ele baixa o conteúdo (vídeo) e mostra o andamento até chegar a 100%.\nSe forem solicitadas permissões, conceda todas.\nConfirme que o aplicativo abre normalmente, que as informações aparecem corretamente e que o sistema funciona normalmente.", warning: "Faça o procedimento na ordem indicada." },
  "enquadramento-totem": { title: "Conferir a tela do totem", instructions: "Olhe para a tela inteira do totem, de frente, com o Atendimento Inteligente aberto.\nTodos os itens da lista abaixo precisam estar corretos na tela. Se algum não estiver, siga o tutorial de ajuste." },
  "correcao-totem": { title: "Minha tela do totem está cortada ou desalinhada", instructions: "Ainda não temos um ajuste padrão para a tela do totem.\nToque em **Não consegui. Preciso de suporte** logo abaixo e a equipe da Intelite vai ajudar você a resolver.", warning: "Não altere configurações do equipamento por conta própria." },
  "atualizar-painel": { title: "Atualizar o painel de chamadas", instructions: "## Remover a versão anterior\n[[video:remover]]\nConecte um mouse USB ao Mini PC.\nVolte à tela inicial: no controle remoto, pressione **Home**; ou, no mouse, clique 3 a 4 vezes com o botão direito.\nAbra **Configurações** e entre em **Apps**.\nToque em **Mostrar apps do sistema** para listar todos os aplicativos.\nLocalize o aplicativo **Atendimento Inteligente - Painel** e abra-o.\nClique em **Desinstalar** e confirme com **OK**. Aguarde a conclusão.\n## Instalar a nova versão\n[[video:instalar]]\nAbra o **Google Chrome** no Mini PC e baixe o aplicativo por uma destas opções. Se uma não funcionar, use outra.\n[[downloads:painel]]\nSe abrir a página do Google Drive, clique em **Download** e, no aviso de vírus, em **Fazer o download mesmo assim**.\nSe o Chrome pedir acesso ao armazenamento, clique em **Continuar** e depois em **Permitir**.\nQuando o download terminar, clique em **Abrir**. Se for solicitado, permita a instalação de aplicativos de fontes desconhecidas.\nClique em **Instalar** e aguarde. Quando aparecer “App instalado”, clique em **Abrir**.\n## Conferir o funcionamento\nAguarde o aplicativo carregar. Na primeira abertura ele baixa o conteúdo (vídeo) e mostra o andamento até chegar a 100%.\nSe forem solicitadas permissões, conceda todas.\nConfirme que o painel abre normalmente, que as informações aparecem corretamente e que o sistema funciona normalmente.", warning: "Faça o procedimento na ordem indicada." },
  "enquadramento-painel": { title: "Conferir a tela do painel", instructions: "Olhe para a tela inteira do painel de chamadas exibindo o Atendimento Inteligente.\nTodos os itens da lista abaixo precisam estar corretos na tela. Se algum não estiver, siga o tutorial de ajuste." },
  "correcao-painel": { title: "Minha tela do painel está cortada ou desalinhada", instructions: "## Ajustar a proporção da tela (TV Box SmartPRO)\n[[video:ajustar]]\nNo controle remoto, pressione **Home** e abra **Configurações**.\nEntre em **Preferências do dispositivo**.\nSelecione **Exibição**.\nAcesse **Ajuste de proporção de tela**.\nCom as setas do controle remoto, ajuste as bordas da imagem.\nReduza a área de exibição aos poucos, até as bordas pretas começarem a aparecer nas laterais e na parte de baixo da tela.\nFaça pequenos ajustes até toda a imagem ficar visível, sem cortes nas extremidades.", warning: "O objetivo é que todo o conteúdo fique visível, sem partes cortadas nas bordas do monitor ou painel." },
  fotos: { title: "Fotos dos equipamentos", instructions: "Fotografe a tela inteira de cada equipamento, de frente.\nMostre as bordas da tela e a interface completa, sem cortar nenhum canto.\nEvite reflexos.", warning: "A equipe usa a foto para avaliar o enquadramento. Uma foto cortada pode ser recusada." },
};
