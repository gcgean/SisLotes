"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gerarParcelasRecorrentes = gerarParcelasRecorrentes;
exports.startDespesaRecorrenteScheduler = startDespesaRecorrenteScheduler;
const data_source_1 = require("../db/data-source");
const Despesa_1 = require("../entities/Despesa");
const DespesaParcela_1 = require("../entities/DespesaParcela");
const despesas_1 = require("../routes/modules/despesas");
const INTERVALO_MS = 6 * 60 * 60 * 1000; // roda a cada 6h
function yyyymm(dateStr) {
    return dateStr.slice(0, 7); // "YYYY-MM"
}
// Para cada despesa recorrente ativa, garante que sempre exista uma parcela
// gerada para o mês corrente (ou futuro). Se a última parcela já gerada é do
// mês atual (ou anterior), cria a próxima com vencimento 1 mês depois,
// mesmo valor da última parcela e numero_parcela incremental.
async function gerarParcelasRecorrentes() {
    try {
        if (!data_source_1.AppDataSource.isInitialized)
            return;
        const despesaRepo = data_source_1.AppDataSource.getRepository(Despesa_1.Despesa);
        const parcelaRepo = data_source_1.AppDataSource.getRepository(DespesaParcela_1.DespesaParcela);
        const despesas = await despesaRepo.find({
            where: { recorrente: true, recorrencia_ativa: true },
        });
        if (despesas.length === 0)
            return;
        const hojeYYYYMM = new Date().toISOString().slice(0, 7);
        for (const despesa of despesas) {
            const ultimaParcela = await parcelaRepo.findOne({
                where: { id_despesa: despesa.id_despesa },
                order: { vencimento: "DESC" },
            });
            if (!ultimaParcela)
                continue; // não deveria acontecer, mas por segurança
            if (yyyymm(ultimaParcela.vencimento) > hojeYYYYMM)
                continue; // já tem parcela futura gerada
            const novaParcela = parcelaRepo.create({
                id_empresa: despesa.id_empresa,
                id_despesa: despesa.id_despesa,
                numero_parcela: ultimaParcela.numero_parcela + 1,
                vencimento: (0, despesas_1.addMonths)(ultimaParcela.vencimento, 1),
                valor: ultimaParcela.valor,
                situacao: "aberto",
            });
            await parcelaRepo.save(novaParcela);
            console.log(`[DespesaRecorrente] Gerada parcela ${novaParcela.numero_parcela} da despesa #${despesa.id_despesa} (${despesa.descricao}) — vencimento ${novaParcela.vencimento}.`);
        }
    }
    catch (err) {
        console.warn("[DespesaRecorrente] Erro ao gerar parcelas recorrentes:", err instanceof Error ? err.message : err);
    }
}
function startDespesaRecorrenteScheduler() {
    // Primeira checagem 45s após o boot, depois a cada 6h.
    setTimeout(() => {
        void gerarParcelasRecorrentes();
        setInterval(() => void gerarParcelasRecorrentes(), INTERVALO_MS);
    }, 45000);
    console.log("[DespesaRecorrente] Agendador de contas recorrentes iniciado (checagem a cada 6h).");
}
