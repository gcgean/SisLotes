import { AppDataSource } from "../db/data-source";
import { Despesa } from "../entities/Despesa";
import { DespesaParcela } from "../entities/DespesaParcela";
import { addMonths } from "../routes/modules/despesas";

const INTERVALO_MS = 6 * 60 * 60 * 1000; // roda a cada 6h

function yyyymm(dateStr: string): string {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

// Para cada despesa recorrente ativa, garante que sempre exista uma parcela
// gerada para o mês corrente (ou futuro). Se a última parcela já gerada é do
// mês atual (ou anterior), cria a próxima com vencimento 1 mês depois,
// mesmo valor da última parcela e numero_parcela incremental.
export async function gerarParcelasRecorrentes(): Promise<void> {
  try {
    if (!AppDataSource.isInitialized) return;

    const despesaRepo = AppDataSource.getRepository(Despesa);
    const parcelaRepo = AppDataSource.getRepository(DespesaParcela);

    const despesas = await despesaRepo.find({
      where: { recorrente: true, recorrencia_ativa: true },
    });

    if (despesas.length === 0) return;

    const hojeYYYYMM = new Date().toISOString().slice(0, 7);

    for (const despesa of despesas) {
      const ultimaParcela = await parcelaRepo.findOne({
        where: { id_despesa: despesa.id_despesa },
        order: { vencimento: "DESC" },
      });
      if (!ultimaParcela) continue; // não deveria acontecer, mas por segurança

      if (yyyymm(ultimaParcela.vencimento) > hojeYYYYMM) continue; // já tem parcela futura gerada

      const novaParcela = parcelaRepo.create({
        id_empresa: despesa.id_empresa,
        id_despesa: despesa.id_despesa,
        numero_parcela: ultimaParcela.numero_parcela + 1,
        vencimento: addMonths(ultimaParcela.vencimento, 1),
        valor: ultimaParcela.valor,
        situacao: "aberto",
      });
      await parcelaRepo.save(novaParcela);

      console.log(
        `[DespesaRecorrente] Gerada parcela ${novaParcela.numero_parcela} da despesa #${despesa.id_despesa} (${despesa.descricao}) — vencimento ${novaParcela.vencimento}.`
      );
    }
  } catch (err) {
    console.warn("[DespesaRecorrente] Erro ao gerar parcelas recorrentes:", err instanceof Error ? err.message : err);
  }
}

export function startDespesaRecorrenteScheduler(): void {
  // Primeira checagem 45s após o boot, depois a cada 6h.
  setTimeout(() => {
    void gerarParcelasRecorrentes();
    setInterval(() => void gerarParcelasRecorrentes(), INTERVALO_MS);
  }, 45_000);
  console.log("[DespesaRecorrente] Agendador de contas recorrentes iniciado (checagem a cada 6h).");
}
