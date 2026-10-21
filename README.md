# Central de Atualização do Atendimento Inteligente — Intelite

Duas partes no mesmo projeto (Next.js + TypeScript, PostgreSQL/Prisma):

- **Página pública (`/`)**: uma tela só, com as etapas em sanfona, uma abaixo da outra e na ordem. Cada etapa concluída libera a próxima. O cliente informa nome e empresa, segue o tutorial (texto ou vídeo), confere a tela do totem e do painel, envia fotos e avalia. Sem login: o progresso fica salvo e ele retoma pelo mesmo dispositivo.
- **Administração (`/admin`)**: indicadores e lista de envios, fotos ampliáveis, aprovação e pedido de nova foto, confirmação do enquadramento, pedidos de ajuda (com “marcar como atendido”), edição do conteúdo do tutorial, exportação CSV, exclusão de envio (LGPD), usuários do admin e troca de senha.

## Rodar localmente

```bash
npm install
npm run dev
```

O comando sobe um PostgreSQL local, cria as tabelas, cadastra o conteúdo inicial e abre o app em http://localhost:3000 (se a porta estiver ocupada, o Next escolhe outra e avisa). Admin: `admin@intelite.local` / `trocar-esta-senha-123`. Na primeira vez cria o `.env`.

| Comando | Para quê |
|---|---|
| `npm run dev` | Tudo em um (banco local + app) |
| `npm run dev:next` | Só o app, com `DATABASE_URL` externo |
| `npm test` | Testes unitários |
| `npm run build && npm run test:e2e` | Fluxo completo em celular (cliente + admin) |

## Abrir de outros computadores da rede

O `npm run dev` já escuta em todas as interfaces e mostra no terminal os endereços, por exemplo `http://192.168.0.10:3000`. Em outro computador ou celular **na mesma rede**, abra esse endereço.

Se não abrir, o culpado quase sempre é o firewall do Windows. Libere a porta uma vez, em um PowerShell **como administrador** (troque 3000 pela porta mostrada no terminal):

```powershell
New-NetFirewallRule -DisplayName "Atualizacao Intelite" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
```

Notas:
- O perfil de rede do Windows precisa ser **Privada** (em redes marcadas como Pública o Windows bloqueia mesmo com a regra acima).
- Em produção por HTTP na rede interna (`npm run build && npm start`), defina `COOKIE_SECURE=false` no `.env`; sem isso o navegador descarta o cookie de sessão e o tutorial não guarda o progresso. Com HTTPS, deixe sem definir.
- Para uso fora da rede local, publique atrás de HTTPS (proxy reverso).

## Etapas (na ordem)

Início: dados · formato. Totem: atualizar · conferir a tela. Painel: atualizar · conferir a tela. Conclusão: fotos · confirmar e avaliar.

Quem tem várias lojas pode iniciar outro envio no mesmo aparelho (botão ao final); o envio anterior continua registrado.

Não dá para pular etapas: uma tela com problema aberto bloqueia o avanço até ser corrigida ou o suporte ser pedido. O formato pode ser trocado a qualquer momento sem perder nada, e assistir ao vídeo nunca é obrigatório.

## Regras que importam

- **Declarado ≠ confirmado.** O cliente declara que a tela está correta; só a **equipe** confirma, e isso exige uma foto aprovada. Se o cliente verificar de novo, a confirmação some.
- **Nada é inventado.** Os textos vêm do admin (`/admin/conteudo`). Etapas sem procedimento cadastrado mostram “procedimento ainda não cadastrado”.
- **Texto dos passos**: um passo por linha; `## Título` abre um bloco, `**texto**` põe em negrito, links viram clicáveis.
- **Vídeos** só de domínios autorizados (editável no admin; padrão YouTube/Vimeo — ajuste conforme a Intelite), carregados sob demanda. O texto continua visível se o vídeo falhar.
- **Fotos**: tipo conferido pelos bytes, até 12 MB, visíveis só ao dono e à equipe.
- **Indicadores**: cada cliente conta uma vez, no formato inicial (quem trocou aparece à parte). “Confirmados” = confirmados pela equipe.

## Pendências de conteúdo

- **Correção de tela do totem**: sem ajuste técnico cadastrado, a página orienta o cliente a pedir suporte. Quando houver um procedimento oficial, basta editar a etapa em `/admin/conteudo`.

## Implantação

`Dockerfile` e `docker-compose.yml` (app + PostgreSQL) estão incluídos, **ainda não testados** (sem Docker na máquina de desenvolvimento). O container cria as tabelas sem apagar dados, garante o conteúdo inicial e o admin, e expõe `/api/health`. Antes de publicar:

1. Definir `SESSION_SECRET` forte, `ADMIN_EMAIL`/`ADMIN_PASSWORD` (e trocar a senha em `/admin/conta`) e as senhas do banco; usar HTTPS.
2. Fotos ficam em disco (volume `photos`): para várias instâncias, implementar a interface `Storage` (`src/lib/storage.ts`) sobre S3 ou similar.
3. O limite de tentativas é em memória (uma instância); fotos podem mostrar pessoas, então defina a retenção (LGPD). A exclusão de envio está no admin.
4. Rodar `npm audit` e atualizar dependências.
