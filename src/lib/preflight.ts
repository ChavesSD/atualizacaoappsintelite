/**
 * Verificação de ambiente antes de subir em produção. Falha cedo, com mensagem clara, em vez de subir
 * com valores de exemplo (ex.: `.env.example` importado no painel da hospedagem) ou apontando para um banco local.
 */
const PLACEHOLDER = /troque|trocar|change[-_ ]?me|exemplo|example/i;

export function checkEnv(env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];

  const db = env.DATABASE_URL?.trim();
  if (!db) {
    problems.push("DATABASE_URL não está definida. Use a “Internal Database URL” do PostgreSQL do Render.");
  } else {
    let host = "";
    try {
      host = new URL(db).hostname;
    } catch {
      problems.push("DATABASE_URL não é uma URL válida (esperado: postgresql://usuário:senha@host:5432/banco).");
    }
    if (host && /^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(host) && env.ALLOW_LOCAL_DB !== "true") {
      problems.push(
        `DATABASE_URL aponta para "${host}", ou seja, para o próprio servidor do app, onde não há banco. ` +
          "No Render, use a “Internal Database URL” do PostgreSQL (não copie o valor do .env.example).",
      );
    }
    if (PLACEHOLDER.test(db)) problems.push("DATABASE_URL contém um valor de exemplo (“troque…”). Informe a URL real do banco.");
  }

  const secret = env.SESSION_SECRET ?? "";
  if (secret.length < 32) problems.push("SESSION_SECRET ausente ou com menos de 32 caracteres. Gere um valor aleatório longo (no Render: “Generate”).");
  else if (PLACEHOLDER.test(secret)) problems.push("SESSION_SECRET está com o valor de exemplo. Qualquer pessoa poderia forjar sessões: gere um segredo aleatório.");

  if (env.ADMIN_PASSWORD && PLACEHOLDER.test(env.ADMIN_PASSWORD)) {
    problems.push("ADMIN_PASSWORD está com a senha de exemplo. Defina uma senha forte para o administrador.");
  }
  return problems;
}
