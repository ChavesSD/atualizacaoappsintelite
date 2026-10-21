# Central de Atualização do Atendimento Inteligente — Intelite

Duas partes, no mesmo projeto (Next.js + TypeScript, PostgreSQL/Prisma):

- **Página pública (`/`)**: o cliente informa seus dados e segue o tutorial (texto ou vídeo) para atualizar o **totem** e o **painel de chamadas**, conferir se a tela está bem enquadrada, enviar fotos e avaliar. Sem login nem código: o progresso fica salvo e o cliente retoma pelo mesmo dispositivo.
- **Administração (`/admin`)**: acompanhar todos os envios, ver e aprovar fotos, confirmar o enquadramento, e editar o conteúdo do tutorial (passos, avisos, imagens, vídeos).

## Rodar localmente

```bash
npm install
npm run dev
```

Só isso. O comando sobe um PostgreSQL local, cria as tabelas, cadastra o conteúdo inicial e abre o app em http://localhost:3000 (admin em `/admin`, usuário `admin@intelite.local`, senha `trocar-esta-senha-123`). Na primeira vez ele cria o `.env`.

| Comando | Para quê |
|---|---|
| `npm run dev` | Tudo em um (banco local + app) |
| `npm run dev:next` | Só o app, com `DATABASE_URL` externo |
| `npm test` | Testes unitários |
| `npm run build && npm run test:e2e` | Fluxo completo em celular (cliente + admin) |

## Fluxo do cliente

dados → formato (texto/vídeo) → atualizar totem → conferir tela do totem → atualizar painel → conferir tela do painel → fotos → enviar.

Não dá para pular etapas: tela com problema aberto bloqueia o avanço até ser corrigida ou o suporte ser pedido. O formato pode ser trocado a qualquer momento sem perder nada; assistir ao vídeo nunca é obrigatório.

## Regras que importam

- **Declarado ≠ confirmado.** O cliente declara que a tela está correta; só a **equipe** confirma, e a confirmação exige uma foto aprovada. Se o cliente verificar de novo, a confirmação some.
- **Nada é inventado.** Os passos de atualização e de correção da tela vêm do admin. Enquanto não cadastrados, a página mostra “procedimento ainda não cadastrado”.
- **Vídeos** só de domínios autorizados (editável em Conteúdo; padrão: YouTube/Vimeo — ajuste conforme a Intelite), com carregamento sob demanda. O texto continua visível se o vídeo falhar.
- **Fotos**: tipo conferido pelos bytes, até 12 MB, visíveis só ao dono e à equipe. A equipe pode pedir nova foto com motivo.
- **Indicadores**: cada cliente conta uma vez, no formato inicial (quem trocou aparece à parte). “Confirmados” = confirmados pela equipe.

## Antes de ir para produção

1. Cadastrar o conteúdo oficial em `/admin/conteudo` (atualização do totem/painel e correção de tela) e revisar os domínios de vídeo.
2. Fotos hoje ficam em disco (`./storage`): implementar a interface `Storage` (`src/lib/storage.ts`) sobre S3 ou similar.
3. Trocar a senha do admin (`ADMIN_EMAIL`/`ADMIN_PASSWORD` antes do primeiro seed) e definir um `SESSION_SECRET` forte; rodar atrás de HTTPS.
4. Limite de tentativas é em memória (uma instância); fotos podem mostrar pessoas — definir retenção (LGPD).
