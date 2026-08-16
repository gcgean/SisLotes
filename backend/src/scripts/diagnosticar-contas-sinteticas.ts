import "reflect-metadata";

async function main() {
  const { AppDataSource } = await import("../db/data-source");
  await AppDataSource.initialize();
  try {
    const [despesas, lancamentos] = await Promise.all([
      AppDataSource.query(`
        SELECT COUNT(*)::int AS total
        FROM despesas d
        WHERE EXISTS (SELECT 1 FROM plano_de_contas filha WHERE filha.id_pai = d.id_categoria)
      `),
      AppDataSource.query(`
        SELECT COUNT(*)::int AS total
        FROM lancamentos_manuais l
        WHERE l.id_conta_contabil IS NOT NULL
          AND EXISTS (SELECT 1 FROM plano_de_contas filha WHERE filha.id_pai = l.id_conta_contabil)
      `),
    ]);
    console.log(JSON.stringify({
      despesas_em_conta_sintetica: Number(despesas[0]?.total ?? 0),
      lancamentos_em_conta_sintetica: Number(lancamentos[0]?.total ?? 0),
    }));
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error("Falha no diagnóstico de contas sintéticas:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
