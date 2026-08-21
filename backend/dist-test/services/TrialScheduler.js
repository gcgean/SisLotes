"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkTrials = checkTrials;
exports.startTrialScheduler = startTrialScheduler;
const data_source_1 = require("../db/data-source");
const Empresa_1 = require("../entities/Empresa");
const Usuario_1 = require("../entities/Usuario");
const TelegramNotificacao_1 = require("../entities/TelegramNotificacao");
const TelegramService_1 = require("./TelegramService");
const DIA_MS = 24 * 60 * 60 * 1000;
const AVISO_VENCENDO_DIAS = 3; // avisa quando faltam <= 3 dias
const JANELA_EXPIRADO_DIAS = 2; // avisa expirados só nos últimos 2 dias (evita flood de trials antigos)
const INTERVALO_MS = 6 * 60 * 60 * 1000; // roda a cada 6h
async function jaNotificado(id_empresa, tipo) {
    const repo = data_source_1.AppDataSource.getRepository(TelegramNotificacao_1.TelegramNotificacao);
    const existe = await repo.findOne({ where: { id_empresa, tipo } });
    return Boolean(existe);
}
async function registrarNotificacao(id_empresa, tipo) {
    const repo = data_source_1.AppDataSource.getRepository(TelegramNotificacao_1.TelegramNotificacao);
    await repo
        .createQueryBuilder()
        .insert()
        .into(TelegramNotificacao_1.TelegramNotificacao)
        .values({ id_empresa, tipo })
        .orIgnore() // ON CONFLICT DO NOTHING (unique id_empresa+tipo)
        .execute();
}
async function telefoneContato(empresa) {
    if (empresa.telefone)
        return empresa.telefone;
    const usuario = await data_source_1.AppDataSource.getRepository(Usuario_1.Usuario).findOne({
        where: { id_empresa: empresa.id_empresa, user_master: true },
    });
    return usuario?.telefone ?? null;
}
async function checkTrials() {
    try {
        if (!data_source_1.AppDataSource.isInitialized)
            return;
        if (!(await TelegramService_1.TelegramService.isTrialNotifyEnabled()))
            return;
        const agora = new Date();
        const limiteFuturo = new Date(agora.getTime() + AVISO_VENCENDO_DIAS * DIA_MS);
        const limitePassado = new Date(agora.getTime() - JANELA_EXPIRADO_DIAS * DIA_MS);
        const candidatos = await data_source_1.AppDataSource.getRepository(Empresa_1.Empresa)
            .createQueryBuilder("e")
            .where("e.ativo = true")
            .andWhere("e.hub_expires_at IS NOT NULL")
            .andWhere("e.hub_expires_at BETWEEN :de AND :ate", { de: limitePassado, ate: limiteFuturo })
            .andWhere("(UPPER(COALESCE(e.plano, '')) = 'TESTE' OR LOWER(COALESCE(e.hub_license_status, '')) IN ('trial', 'trialing'))")
            .getMany();
        for (const empresa of candidatos) {
            const vencimento = empresa.hub_expires_at;
            const diffMs = vencimento.getTime() - agora.getTime();
            const diasRestantes = Math.ceil(diffMs / DIA_MS);
            const tipo = diffMs >= 0 ? "trial_vencendo" : "trial_expirado";
            if (await jaNotificado(empresa.id_empresa, tipo))
                continue;
            const telefone = await telefoneContato(empresa);
            const enviado = await TelegramService_1.TelegramService.notifyTrial({
                empresa: empresa.nome_fantasia,
                cnpj: empresa.cnpj ?? null,
                telefone,
                vencimento,
                diasRestantes,
            });
            if (enviado) {
                await registrarNotificacao(empresa.id_empresa, tipo);
                console.log(`[TrialScheduler] Notificado ${tipo} para empresa #${empresa.id_empresa} (${empresa.nome_fantasia}).`);
            }
        }
    }
    catch (err) {
        console.warn("[TrialScheduler] Erro ao checar trials:", err instanceof Error ? err.message : err);
    }
}
function startTrialScheduler() {
    // Primeira checagem 30s após o boot, depois a cada 6h.
    setTimeout(() => {
        void checkTrials();
        setInterval(() => void checkTrials(), INTERVALO_MS);
    }, 30000);
    console.log("[TrialScheduler] Agendador de avisos de trial iniciado (checagem a cada 6h).");
}
