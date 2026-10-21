# Central de Atualização do Atendimento Inteligente — Intelite

Duas partes no mesmo projeto (Next.js + TypeScript, PostgreSQL/Prisma):

- **Página pública (`/`)**: uma tela só, com as etapas em sanfona, uma abaixo da outra e na ordem. Cada etapa concluída libera a próxima. O cliente informa nome e empresa, segue o tutorial (texto ou vídeo), baixa os aplicativos, confere a tela do totem e do painel, envia fotos e avalia. Sem login: o progresso fica salvo e ele retoma pelo mesmo dispositivo.
- **Administração (`/admin`)**: indicadores e lista de envios, fotos ampliáveis, aprovação e pedido de nova foto, confirmação do enquadramento, pedidos de ajuda (com “marcar como atendido”), edição do conteúdo do tutorial e dos links de download, exportação CSV, exclusão de envio (LGPD), usuários do admin e troca de senha.

## Rodar localmente

```bash
npm install
npm run dev
```

O comando sobe um PostgreSQL local, cria as tabelas, cadastra o conteúdo inicial e abre o app em http://localhost:3000 (se a porta estiver ocupada, o Next escolhe outra e avisa). Admin: `admin@intelite.local` / `trocar-esta-senha-123` (senha padrão só em banco local). Na primeira vez cria o `.env`.

| Comando | Para quê |
|---|---|
| `npm run dev` | Tudo em um (banco local + app) |
| `npm run dev:next` | Só o app, com `DATABASE_URL` externo |
| `npm test` | Testes unitários |
| `npm run build && npm run test:e2e` | Fluxo completo em celular (cliente + admin), com fotos no banco |

## Download dos aplicativos

Em “Atualizar o totem” e “Atualizar o painel”, o cliente vê três formas de baixar, para não ficar travado se uma falhar:

1. **Opções 1 e 2: links curtos** (ex.: `bit.ly/aitotem26`, `shre.ink/aitotem26`). São editáveis em `/admin/conteudo` → “Links de download” (até 5 por aplicativo, só https).
2. **Última opção: download direto da página**, que serve o APK da pasta [`downloads/`](downloads). Aceita retomar um download interrompido (`Range`), o que ajuda em conexões instáveis.

Para publicar uma **nova versão** do APK: coloque o arquivo em `downloads/`, ajuste `version`, `file` e `filename` em [`src/lib/downloads.ts`](src/lib/downloads.ts) e faça o deploy. (Cada versão nova de APK aumenta o repositório em ~10–13 MB.)

Em qualquer texto de etapa, a linha `[[downloads:totem]]` ou `[[downloads:painel]]` mostra esse bloco de opções.

## Publicar no Render

O arquivo [`render.yaml`](render.yaml) descreve o app e o banco PostgreSQL.

1. No Render: **New → Blueprint** e escolha este repositório. Informe `ADMIN_EMAIL` e `ADMIN_PASSWORD` quando pedir (o admin é criado no primeiro deploy; o sistema **recusa** subir com a senha padrão em banco que não é local).
2. Confira os planos sugeridos (app `0.5c-512mb`, banco `0.1c-256mb`) e a região, e confirme. O `SESSION_SECRET` é gerado automaticamente.
3. Ao terminar, abra `https://<nome>.onrender.com` (cliente) e `/admin` (equipe). Troque a senha em **Conta**.

Como funciona no Render:
- **Fotos e imagens ficam no PostgreSQL** (`STORAGE_DRIVER=db`), porque o disco do Render é efêmero: arquivos em disco se perderiam a cada deploy. Para volumes grandes, use S3/R2 implementando a interface `Storage` (`src/lib/storage.ts`).
- Os **APKs vão junto no deploy** (estão no repositório).
- O comando de início cria/atualiza as tabelas **sem apagar dados** (se uma mudança de schema apagaria dados, o deploy falha de propósito, para você decidir) e o app expõe `/api/health`.
- HTTPS já vem do Render, então o cookie de sessão é `secure` por padrão.

Se o **build falhar por falta de memória** no plano de 512 MB, suba o plano do app. Instâncias gratuitas “dormem” e demoram a acordar, o que atrapalha quem abre o link em campo.

> O `render.yaml` segue a documentação atual do Render, mas **não foi testado em um serviço real** (nem o Docker nesta máquina): valide o primeiro deploy.

## Abrir de outros computadores da rede

O `npm run dev` já escuta em todas as interfaces e mostra no terminal os endereços, por exemplo `http://192.168.0.10:3000`. Em outro computador ou celular **na mesma rede**, abra esse endereço.

Se não abrir, o culpado quase sempre é o firewall do Windows. Libere a porta uma vez, em um PowerShell **como administrador** (troque 3000 pela porta mostrada no terminal):

```powershell
New-NetFirewallRule -DisplayName "Atualizacao Intelite" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
```

Notas:
- O perfil de rede do Windows precisa ser **Privada** (em redes marcadas como Pública o Windows bloqueia mesmo com a regra acima).
- Em produção por HTTP na rede interna (`npm run build && npm start`), defina `COOKIE_SECURE=false` no `.env`; sem isso o navegador descarta o cookie de sessão e o tutorial não guarda o progresso. Com HTTPS, deixe sem definir.

## Etapas (na ordem)

Início: dados · formato. Totem: atualizar · conferir a tela. Painel: atualizar · conferir a tela. Conclusão: fotos · confirmar e avaliar.

Quem tem várias lojas pode iniciar outro envio no mesmo aparelho (botão ao final); o envio anterior continua registrado.

Não dá para pular etapas: uma tela com problema aberto bloqueia o avanço até ser corrigida ou o suporte ser pedido. O formato pode ser trocado a qualquer momento sem perder nada, e assistir ao vídeo nunca é obrigatório.

## Regras que importam

- **Declarado ≠ confirmado.** O cliente declara que a tela está correta; só a **equipe** confirma, e isso exige uma foto aprovada. Se o cliente verificar de novo, a confirmação some.
- **Nada é inventado.** Os textos vêm do admin (`/admin/conteudo`). Para a **correção de tela do totem**, sem ajuste técnico cadastrado a página orienta o cliente a pedir suporte; quando houver procedimento oficial, basta editar a etapa.
- **Texto dos passos**: um passo por linha; `## Título` abre um bloco, `**texto**` põe em negrito, links viram clicáveis.
- **Vídeos** só de domínios autorizados (editável no admin; padrão YouTube/Vimeo — ajuste conforme a Intelite), carregados sob demanda. O texto continua visível se o vídeo falhar.
- **Fotos**: tipo conferido pelos bytes, até 12 MB, visíveis só ao dono e à equipe.
- **Indicadores**: cada cliente conta uma vez, no formato inicial (quem trocou aparece à parte). “Confirmados” = confirmados pela equipe.

## Outras formas de implantação

`Dockerfile` e `docker-compose.yml` (app + PostgreSQL) estão incluídos, **ainda não testados**. Em qualquer ambiente: defina `SESSION_SECRET` forte, `ADMIN_EMAIL`/`ADMIN_PASSWORD`, use HTTPS e troque a senha em `/admin/conta`. O limite de tentativas de login é em memória (uma instância). Fotos podem mostrar pessoas: defina a retenção (LGPD); a exclusão de envio está no admin.
