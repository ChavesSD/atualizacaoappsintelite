import { checkEnv } from "../src/lib/preflight";

const problems = checkEnv(process.env);
if (problems.length) {
  console.error("\n✖ O app não vai subir: configuração de ambiente incorreta.\n");
  for (const p of problems) console.error(`  • ${p}`);
  console.error("\nCorrija as variáveis de ambiente do serviço (Render → Environment) e faça um novo deploy.\n");
  process.exit(1);
}
console.log("✔ Variáveis de ambiente conferidas.");
