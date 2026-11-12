# Central de Atualização do Atendimento Inteligente — Intelite

Duas partes no mesmo projeto (Next.js + TypeScript, PostgreSQL/Prisma):

- **Página pública (`/`)**, tema preto: abre com “Quer atualizar seu app Intelite?”, o cliente escolhe a solução (hoje só o Atendimento Inteligente) e informa nome e empresa. Em seguida segue quatro fases, em ordem: **Atualizar** (vídeo com narração e legendas e passo a passo escrito lado a lado, sincronizados), **Conferir a tela**, **Foto** e **Finalizar**. Um só aplicativo (híbrido) atende totem e painel. Sem login: o progresso fica salvo e ele retoma pelo mesmo dispositivo.
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

O aplicativo atual é **híbrido: o mesmo APK serve para o totem e para o painel**. Na fase “Atualizar”, o cliente vê as opções de download abaixo, para não ficar travado se uma falhar:

1. **Opções 1 e 2: links curtos** (hoje `is.gd/aihib19` e `v.gd/aihib19`, iguais para totem e painel). São editáveis em `/admin/conteudo` → “Links de download” (até 5 por aplicativo, só https).
2. **Última opção: download direto da página**, que serve o APK híbrido da pasta [`downloads/`](downloads) (`ai-hibrido-1.19.apk`, o mesmo arquivo para totem e painel). Aceita retomar um download interrompido (`Range`), o que ajuda em conexões instáveis.

Para publicar uma **nova versão** do APK: coloque o arquivo em `downloads/`, ajuste `APK` (versão, arquivo e nome) em [`src/lib/downloads.ts`](src/lib/downloads.ts) e faça o deploy. (Cada versão nova de APK aumenta o repositório em ~10–13 MB.)

Em qualquer texto de etapa, a linha `[[downloads]]` mostra esse bloco de opções.

## Vídeos do tutorial

O vídeo completo da atualização (`tutorial.mp4`, com narração e legendas) aparece ao lado do passo a passo. Cada bloco `## Título` do texto da fase “Atualizar” corresponde a um capítulo do vídeo, na mesma ordem: o passo acende conforme o vídeo avança, e “Ver no vídeo” leva o player ao capítulo. O vídeo de ajuste da tela (`ajustar`) fica no tutorial de “tela cortada”.

- Os arquivos estão em [`downloads/videos`](downloads/videos): `tutorial.mp4` (+ `tutorial.jpg` miniatura, `tutorial.vtt` legendas e `tutorial.json` com título, duração e capítulos) e `ajustar.mp4`. São servidos com `Range`, então avançam e carregam bem no celular; o vídeo só é baixado depois do toque em ▶. Como refazer o vídeo: veja [`video/`](video).
- No texto de uma etapa (`/admin/conteudo`), a linha `[[video:ajustar]]` mostra o vídeo de ajuste no ponto desejado.
- Para trocar o vídeo principal: substitua os quatro arquivos `tutorial.*` mantendo os nomes e faça o deploy.
- Além desses, o campo “Link do vídeo” de cada etapa continua aceitando YouTube/Vimeo de domínios autorizados.

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

**Se você criou o serviço manualmente** (o Render detecta o `Dockerfile` e usa Docker), crie antes um **PostgreSQL** no Render (mesma região) e cadastre estas variáveis em *Environment* do serviço. **Não importe o `.env.example`**: ele traz valores de exemplo.

| Variável | Valor |
|---|---|
| `DATABASE_URL` | *Internal Database URL* do PostgreSQL do Render |
| `SESSION_SECRET` | aleatório, ≥ 32 caracteres (botão *Generate*) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | e-mail e senha forte do administrador |
| `STORAGE_DRIVER` | `db` (já é o padrão da imagem) |

Antes de subir, o app confere essas variáveis e **recusa iniciar** com banco local (`localhost`), `SESSION_SECRET` curto ou de exemplo e senha de admin de exemplo, dizendo no log o que corrigir. O app usa a porta `PORT` que o Render fornece.

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

**Abertura** (solução, nome e empresa) → **1 Atualizar** → **2 Conferir a tela** → **3 Foto** → **4 Finalizar** (avaliação).

Quem tem várias lojas pode iniciar outro envio no mesmo aparelho (botão ao final); o envio anterior continua registrado.

Não dá para pular etapas: uma tela com problema aberto bloqueia o avanço até ser corrigida ou o suporte ser pedido. Assistir ao vídeo nunca é obrigatório: o texto cobre tudo, e o vídeo é o mesmo caminho.

## Regras que importam

- **Declarado ≠ confirmado.** O cliente declara que a tela está correta; só a **equipe** confirma, e isso exige uma foto aprovada. Se o cliente verificar de novo, a confirmação some.
- **Nada é inventado.** Os textos vêm do admin (`/admin/conteudo`). O tutorial de ajuste de tela (“tela cortada”) também é editável.
- **Texto dos passos**: um passo por linha; `## Título` abre um bloco, `**texto**` põe em negrito, links viram clicáveis.
- **Vídeos** só de domínios autorizados (editável no admin; padrão YouTube/Vimeo — ajuste conforme a Intelite), carregados sob demanda. O texto continua visível se o vídeo falhar.
- **Fotos**: tipo conferido pelos bytes, até 12 MB, visíveis só ao dono e à equipe.
- **Indicadores**: funil por fase, tempo típico até concluir (mediana) e pedidos de ajuda em aberto. “Confirmadas” = confirmadas pela equipe.

## Outras formas de implantação

`Dockerfile` e `docker-compose.yml` (app + PostgreSQL) estão incluídos, **ainda não testados**. Em qualquer ambiente: defina `SESSION_SECRET` forte, `ADMIN_EMAIL`/`ADMIN_PASSWORD`, use HTTPS e troque a senha em `/admin/conta`. O limite de tentativas de login é em memória (uma instância). Fotos podem mostrar pessoas: defina a retenção (LGPD); a exclusão de envio está no admin.
