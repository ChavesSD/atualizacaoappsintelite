# Central de Atualização do Atendimento Inteligente — Intelite

Aplicação web (Next.js + TypeScript, PostgreSQL/Prisma) para guiar clientes na atualização do **totem** e do **painel de chamadas**, verificar o **enquadramento da tela** de cada equipamento e acompanhar tudo em um dashboard administrativo.

## Rodando localmente

```bash
npm install
cp .env.example .env          # ajuste SESSION_SECRET
npm run db:local              # Postgres embutido (porta 5433) — deixe rodando
npm run db:push               # cria as tabelas (outro terminal)
npm run db:seed               # etapas, critérios, admins e campanha demo (imprime os códigos de acesso)
npm run dev
```

- Cliente: `http://localhost:3000` (código da unidade; também aceita `/#CODIGO`, o fragmento não vai ao servidor).
- Equipe: `/admin` — `admin@intelite.local` / `tecnico@intelite.local` (senha do seed; **troque em produção**, use `SEED_ADMIN_PASSWORD`).

## Testes

| Comando | O que cobre |
|---|---|
| `npm test` | Regras puras: fluxo de etapas, máquina de estados do enquadramento, validação de URL de vídeo, upload, conclusão operacional, indicadores |
| `npm run test:integration` | Serviços contra um PostgreSQL real descartável: sessão única, alternância de formato, enquadramento → correção → nova verificação, fotos, validação técnica, auditoria, dashboard, versionamento de conteúdo |
| `npm run build && npm run test:e2e` | Fluxo completo em viewport de celular (Pixel 7) + painel administrativo + dashboard |

## Fluxo do cliente

identificação → escolha texto/vídeo → atualização do totem → **enquadramento do totem** → atualização do painel → **enquadramento do painel** → fotos → confirmação e avaliação.

Não é possível pular etapas obrigatórias. O progresso é gravado no servidor a cada ação; trocar de formato altera apenas `currentFormat` (mesma sessão, nada é reiniciado ou duplicado). A conclusão de uma etapa nunca depende de assistir ao vídeo.

## Regras de negócio centrais

- **Autodeclaração ≠ validação técnica.** O cliente declara (`FramingCheck.status`); a equipe valida (`technicalStatus/By/At/Notes`), em campos separados. Validar exige uma foto aceita. Qualquer nova verificação/ajuste do cliente, ou recusa de foto, invalida a validação anterior (o histórico permanece).
- **Conclusão operacional** (`domain/completion.ts`): `EM_ANDAMENTO → AGUARDANDO_VALIDACAO_TECNICA → CONCLUIDA_OPERACIONALMENTE` (ou `PENDENCIAS`). A campanha define `requireTechnicalValidation`.
- **Nada inventado.** Parâmetros de resolução/DPI/escala/comandos só existem como `CorrectionProcedure` cadastrado e **publicado (aprovado)** pela equipe técnica, versionado, filtrado por equipamento, modelo e problema relatado. Sem cadastro, o cliente é orientado ao suporte.
- **Vídeos**: somente `https`, domínio em `AllowedVideoHost` (ou subdomínio), sem credenciais/porta; revalidados a cada leitura. Vídeo é carregado sob demanda (miniatura + `preload="none"`). O texto é obrigatório para publicar e continua disponível se o vídeo falhar.
- **Fotos**: tipo verificado pelos bytes (JPEG/PNG/WebP), limite de 12 MB, nome gerado no servidor, acesso só ao dono ou à equipe.
- **Auditoria** somente-inserção (`AuditLog`) + histórico de enquadramento (`FramingEvent`) com formato e etapa em uso.

## Indicadores (como são calculados)

- Universo = `CampaignUnit` filtradas. Percentuais de enquadramento usam esse universo como denominador (não só quem iniciou).
- Cada unidade tem uma sessão; quem trocou de formato é contado **uma vez**, no formato inicial (`Trocaram de formato` informa quantas trocaram).
- "Confirmado" nos cards = **validado tecnicamente**; o número declarado pelo cliente aparece como complemento.
- Dificuldade por formato/etapa = unidades distintas com pedido de suporte ou verificação incorreta na etapa, no formato em uso naquele momento.
- Período filtra pela data de início da sessão (e pela data do evento nas séries de evolução).

## Pendências antes de produção

1. **Conteúdo oficial**: as etapas "Atualizar o totem/painel" entram com aviso de "procedimento ainda não cadastrado". Cadastre e publique em `/admin/conteudo`; cadastre vídeos (após autorizar o domínio em `/admin/configuracoes`) e os procedimentos de correção em `/admin/procedimentos`.
2. **Armazenamento**: o driver `local` é só para desenvolvimento. Implemente a interface `Storage` (`src/lib/storage.ts`) sobre um bucket S3-compatível.
3. **Rate limit** é em memória (por instância); use Redis se houver várias instâncias.
4. Troque as senhas do seed, defina `SESSION_SECRET` forte e rode atrás de HTTPS.
5. Rode `npm audit` e atualize dependências (há avisos reportados na instalação).
6. LGPD: fotos podem registrar pessoas no ambiente; defina política de retenção.
