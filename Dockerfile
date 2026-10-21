# Imagem de produção. Não testada nesta máquina (sem Docker): valide no seu ambiente.
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npx next build
ENV NODE_ENV=production
# Hospedagens com disco efêmero (Render): fotos no banco. Sobrescreva com STORAGE_DRIVER=local se tiver disco persistente.
ENV STORAGE_DRIVER=db
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Cria/atualiza as tabelas (sem apagar dados), garante o conteúdo inicial e o admin, e sobe o app.
# Confere o ambiente (falha com mensagem clara), cria/atualiza tabelas sem apagar dados, garante conteúdo e admin, e sobe
# na porta que a hospedagem fornece (PORT; o Render usa 10000 por padrão).
CMD ["sh", "-c", "npx tsx scripts/preflight.ts && npx prisma db push --skip-generate && npx tsx prisma/seed.ts && npx next start -H 0.0.0.0 -p ${PORT:-3000}"]
