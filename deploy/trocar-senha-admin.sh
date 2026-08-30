#!/usr/bin/env bash
#
# Troca a senha de um usuário do CRM.
#
#   ./trocar-senha-admin.sh                          # admin@solarcosta.com.br
#   ./trocar-senha-admin.sh outro@solarcosta.com.br
#
# A senha é digitada sem eco, vira hash bcrypt (custo 12) no próprio processo
# Node e só o hash chega ao banco. Ela não passa pela linha de comando, não
# entra no histórico do shell e não aparece em `ps`.
#
# Trocar a senha revoga todas as sessões abertas daquele usuário.

set -Eeuo pipefail

EMAIL="${1:-admin@solarcosta.com.br}"

# Encontra o server/ a partir da posição deste script.
DIR_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIR_SERVER="${SERVER_DIR:-$(cd "${DIR_SCRIPT}/../server" 2>/dev/null && pwd || echo '')}"

[ -n "$DIR_SERVER" ] || { echo "server/ não encontrado. Defina SERVER_DIR."; exit 1; }
[ -f "${DIR_SERVER}/.env" ] || { echo "${DIR_SERVER}/.env não encontrado."; exit 1; }
[ -d "${DIR_SERVER}/node_modules" ] || { echo "rode 'npm install' em ${DIR_SERVER} primeiro."; exit 1; }

echo "Trocando a senha de: ${EMAIL}"
echo

cd "$DIR_SERVER"

# Todo o trabalho acontece dentro do Node: ele lê o .env (mesma configuração da
# API), pede a senha sem eco, gera o hash e faz o UPDATE.
node --input-type=module -e '
import readline from "node:readline";
import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";

const email = process.argv[1];

function perguntarSenha(rotulo) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(rotulo);
    rl._writeToOutput = () => {};
    rl.question("", (r) => { process.stdout.write("\n"); rl.close(); resolve(r); });
  });
}

const senha  = await perguntarSenha("Nova senha (mín. 8 caracteres): ");
const repete = await perguntarSenha("Repita a senha: ");

if (senha !== repete)   { console.error("\nAs senhas não conferem."); process.exit(1); }
if (senha.length < 8)   { console.error("\nMínimo de 8 caracteres."); process.exit(1); }
if (/^(123|senha|admin|solar)/i.test(senha)) {
  console.error("\nEssa senha é fácil demais de adivinhar. Escolha outra.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

const cliente = await pool.connect();
try {
  await cliente.query("BEGIN");

  const hash = await bcrypt.hash(senha, 12);

  const { rows } = await cliente.query(
    `UPDATE "SolarCosta_Usuarios" SET senha_hash = $2
      WHERE email = $1 AND excluido_em IS NULL
      RETURNING id, nome, cargo::text AS cargo`,
    [email, hash],
  );

  if (rows.length === 0) {
    await cliente.query("ROLLBACK");
    console.error(`\nUsuário ${email} não encontrado.`);
    process.exit(1);
  }

  const usuario = rows[0];

  const { rowCount } = await cliente.query(
    `UPDATE "SolarCosta_Sessoes" SET revogado_em = now()
      WHERE usuario_id = $1 AND revogado_em IS NULL`,
    [usuario.id],
  );

  await cliente.query(
    `SELECT set_config($1, $2, true), set_config($3, $4, true)`,
    ["app.usuario_id", usuario.id, "app.usuario_nome", usuario.nome],
  );
  await cliente.query(
    `SELECT "SolarCosta_fn_auditar"($1,$2,$3,$4,$5)`,
    ["editar", "Usuário", usuario.nome, usuario.id, "Senha redefinida via script de manutenção."],
  );

  await cliente.query("COMMIT");

  console.log(`\n  Senha alterada: ${usuario.nome} (${usuario.cargo})`);
  console.log(`  ${rowCount} sessão(ões) revogada(s) — quem estava logado precisa entrar de novo.`);
} catch (e) {
  await cliente.query("ROLLBACK").catch(() => {});
  console.error("\nFalhou:", e.message);
  process.exit(1);
} finally {
  cliente.release();
  await pool.end();
}
' "$EMAIL"
