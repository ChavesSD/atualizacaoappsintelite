# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 15 (App Router) + React 19 + TypeScript, Prisma + PostgreSQL, hospedado no Render (Docker). Decidido pelo time desde o início do projeto.

## Users

- **Cliente da Intelite** (gerente de loja, atendente ou TI da unidade): abre a página no celular ou notebook, em pé ao lado do Mini PC conectado ao totem ou à TV do painel de chamadas, e segue o passo a passo enquanto mexe no equipamento. Não é técnico. Quer terminar rápido e ter certeza de que deu certo.
- **Equipe da Intelite** (suporte): acompanha pelo painel administrativo quem já atualizou, confere a foto da tela e confirma o enquadramento.

## Product Purpose

Levar o cliente da versão atual do aplicativo Atendimento Inteligente para a nova, sem ligar para o suporte: o cliente escolhe a solução, segue o passo a passo (texto e vídeo ao mesmo tempo), confere se a tela ficou correta, envia uma foto e avalia. A equipe vê o andamento e valida. Sucesso = cliente conclui sozinho, tela correta, equipe confirma.

## Positioning

Um único aplicativo híbrido atende totem e painel de chamadas, então há um só caminho de atualização. O passo a passo é escrito e em vídeo narrado, lado a lado, e o cliente confirma o resultado com uma foto que a equipe valida (declarado pelo cliente ≠ confirmado pela equipe).

## Operating Context

- O Mini PC é um Android TV box (por exemplo, TV Box SmartPRO) ligado ao totem ou à TV; controle por mouse USB ou controle remoto.
- O download do aplicativo é feito pelo Chrome do próprio Mini PC, por links curtos (bit.ly e shre.ink `aihib15`) ou pelo download direto da página (APK híbrido 1.19); o direto exige copiar o APK para um pendrive para instalar no Mini PC.
- A atualização é feita instalando por cima da versão atual: não é preciso desinstalar o aplicativo antigo.
- Hoje só existe uma solução (Atendimento Inteligente); a página deve aceitar outras no futuro.

## Capabilities and Constraints

- Cliente informa só nome e empresa; progresso é salvo por cookie assinado no aparelho.
- Fotos ficam no banco (`STORAGE_DRIVER=db`, disco efêmero no Render). Exclusão de envio (LGPD) pelo admin.
- Tutorial editável no admin (texto das etapas, links de download, domínios de vídeo). O vídeo principal e as legendas são arquivos do repositório.
- Hospedagem barata (Render 0.5 CPU): arquivos grandes servidos com suporte a Range.
- Pendente de confirmação: nome do aplicativo híbrido depois de instalado e se ele pede alguma escolha (totem ou painel) na primeira abertura.

## Brand Commitments

- Marca Intelite Tecnologia; logo branca (`public/logo-intelite.webp`).
- Tema escuro (preto) pedido explicitamente pelo cliente do projeto, em 2026-11.
- Português do Brasil, tom direto e humano.

## Evidence on Hand

- APK híbrido 1.19 em `downloads/ai-hibrido-1.19.apk`.
- Vídeo de ajuste de proporção da tela em `downloads/videos/ajustar.mp4` (gravação da Intelite).
- Não há depoimentos, métricas de clientes nem preços: não inventar.

## Product Principles

1. **Direto ao ponto.** Pergunta, escolha, passo a passo. Nada de etapas que o cliente não precisa.
2. **Texto e vídeo juntos.** Quem lê e quem assiste seguem o mesmo caminho, sincronizados.
3. **O cliente declara, a equipe confirma.** Nunca tratar autodeclaração como validação.
4. **Funciona de pé, com uma mão e sol na tela.** Celular primeiro, alvos grandes, contraste alto.
5. **Humano, não robótico.** Voz e textos como uma pessoa da Intelite ajudando ao lado.

## Accessibility & Inclusion

WCAG 2.2 AA como piso: contraste, foco visível, teclado, leitor de tela, `prefers-reduced-motion`, legendas no vídeo, alvos de toque ≥ 44px. Auditoria automática com axe nos testes E2E.
