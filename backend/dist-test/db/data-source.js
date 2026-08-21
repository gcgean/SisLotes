"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const Cliente_1 = require("../entities/Cliente");
const Loteamento_1 = require("../entities/Loteamento");
const Lote_1 = require("../entities/Lote");
const Conta_1 = require("../entities/Conta");
const Usuario_1 = require("../entities/Usuario");
const Venda_1 = require("../entities/Venda");
const Pagamento_1 = require("../entities/Pagamento");
const Log_1 = require("../entities/Log");
const Empresa_1 = require("../entities/Empresa");
const Auditoria_1 = require("../entities/Auditoria");
const HubBillingCharge_1 = require("../entities/HubBillingCharge");
const HubBillingEvent_1 = require("../entities/HubBillingEvent");
const Sugestao_1 = require("../entities/Sugestao");
const SugestaoMensagem_1 = require("../entities/SugestaoMensagem");
const TelegramConfig_1 = require("../entities/TelegramConfig");
const TelegramNotificacao_1 = require("../entities/TelegramNotificacao");
const LpEvento_1 = require("../entities/LpEvento");
const PlanoDeContas_1 = require("../entities/PlanoDeContas");
const Fornecedor_1 = require("../entities/Fornecedor");
const Despesa_1 = require("../entities/Despesa");
const DespesaParcela_1 = require("../entities/DespesaParcela");
const LancamentoManual_1 = require("../entities/LancamentoManual");
const DespesaRateio_1 = require("../entities/DespesaRateio");
const LancamentoRateio_1 = require("../entities/LancamentoRateio");
const TransferenciaConta_1 = require("../entities/TransferenciaConta");
const CobrancaBancaria_1 = require("../entities/CobrancaBancaria");
const CobrancaRegra_1 = require("../entities/CobrancaRegra");
const CobrancaComunicacao_1 = require("../entities/CobrancaComunicacao");
const OrcamentoLoteamento_1 = require("../entities/OrcamentoLoteamento");
const FechamentoFinanceiro_1 = require("../entities/FechamentoFinanceiro");
const VendaAcordo_1 = require("../entities/VendaAcordo");
const _1700000000000_CreateClientes_1 = require("../migrations/1700000000000-CreateClientes");
const _1700000000001_CreateCoreTables_1 = require("../migrations/1700000000001-CreateCoreTables");
const _1700000000002_CreateEmpresasAndMultiTenant_1 = require("../migrations/1700000000002-CreateEmpresasAndMultiTenant");
const _1700000000003_AddEmpresaAtivo_1 = require("../migrations/1700000000003-AddEmpresaAtivo");
const _1700000000004_AddProprietarioFieldsToLoteamento_1 = require("../migrations/1700000000004-AddProprietarioFieldsToLoteamento");
const _1700000000005_AddLogoToEmpresa_1 = require("../migrations/1700000000005-AddLogoToEmpresa");
const _1700000000006_MultiTenantEnsureEmpresaGeral_1 = require("../migrations/1700000000006-MultiTenantEnsureEmpresaGeral");
const _1700000000007_FixEmpresasSequence_1 = require("../migrations/1700000000007-FixEmpresasSequence");
const _1700000000008_AddEmailTelefoneToUsuario_1 = require("../migrations/1700000000008-AddEmailTelefoneToUsuario");
const _1700000000009_AddSalarioMinimoAndVendaSnapshots_1 = require("../migrations/1700000000009-AddSalarioMinimoAndVendaSnapshots");
const _1700000000010_CreateAuditoria_1 = require("../migrations/1700000000010-CreateAuditoria");
const _1700000000011_AddAdminFieldsToEmpresa_1 = require("../migrations/1700000000011-AddAdminFieldsToEmpresa");
const _1700000000012_AddHubBillingFieldsToEmpresa_1 = require("../migrations/1700000000012-AddHubBillingFieldsToEmpresa");
const _1700000000013_CreateHubBillingCharges_1 = require("../migrations/1700000000013-CreateHubBillingCharges");
const _1700000000014_CreateHubBillingEvents_1 = require("../migrations/1700000000014-CreateHubBillingEvents");
const _1700000000015_AddWebhookEventIdToHubBillingEvents_1 = require("../migrations/1700000000015-AddWebhookEventIdToHubBillingEvents");
const _1700000000016_AddIgnorePlanControlToEmpresa_1 = require("../migrations/1700000000016-AddIgnorePlanControlToEmpresa");
const _1700000000016_AllowEntradaTipoPagamento_1 = require("../migrations/1700000000016-AllowEntradaTipoPagamento");
const _1700000000017_AddModeloContratoToEmpresa_1 = require("../migrations/1700000000017-AddModeloContratoToEmpresa");
const _1700000000018_FixAllSequences_1 = require("../migrations/1700000000018-FixAllSequences");
const _1700000000019_CreateSugestoes_1 = require("../migrations/1700000000019-CreateSugestoes");
const _1700000000020_AddReajustadoToPagamentos_1 = require("../migrations/1700000000020-AddReajustadoToPagamentos");
const _1700000000021_FixVendaLoteUniqueConstraint_1 = require("../migrations/1700000000021-FixVendaLoteUniqueConstraint");
const _1700000000022_AddEncargosToEmpresa_1 = require("../migrations/1700000000022-AddEncargosToEmpresa");
const _1700000000023_AddAtivoToConta_1 = require("../migrations/1700000000023-AddAtivoToConta");
const _1700000000024_CreateTelegramConfig_1 = require("../migrations/1700000000024-CreateTelegramConfig");
const _1700000000025_CreateTelegramNotificacao_1 = require("../migrations/1700000000025-CreateTelegramNotificacao");
const _1700000000026_CreateLpEvento_1 = require("../migrations/1700000000026-CreateLpEvento");
const _1700000000027_AddLastLoginToUsuario_1 = require("../migrations/1700000000027-AddLastLoginToUsuario");
const _1700000000028_CreateDespesas_1 = require("../migrations/1700000000028-CreateDespesas");
const _1700000000029_AddSaldoLancamentos_1 = require("../migrations/1700000000029-AddSaldoLancamentos");
const _1700000000030_CreatePlanoDeContas_1 = require("../migrations/1700000000030-CreatePlanoDeContas");
const _1700000000031_AddRecorrenciaToDespesas_1 = require("../migrations/1700000000031-AddRecorrenciaToDespesas");
const _1700000000032_AddRateioAndFornecedorLancamento_1 = require("../migrations/1700000000032-AddRateioAndFornecedorLancamento");
const _1700000000033_AddChatAndAnexoToSugestoes_1 = require("../migrations/1700000000033-AddChatAndAnexoToSugestoes");
const _1700000000034_CreateMovimentosFinanceirosView_1 = require("../migrations/1700000000034-CreateMovimentosFinanceirosView");
const _1700000000035_SeedPlanoContasReceitas_1 = require("../migrations/1700000000035-SeedPlanoContasReceitas");
const _1700000000036_CreateTransferenciasContas_1 = require("../migrations/1700000000036-CreateTransferenciasContas");
const _1700000000037_CreateConciliacaoBancaria_1 = require("../migrations/1700000000037-CreateConciliacaoBancaria");
const _1700000000038_AddEncargosDespesaParcela_1 = require("../migrations/1700000000038-AddEncargosDespesaParcela");
const _1700000000039_CreateDespesaParcelaPagamentos_1 = require("../migrations/1700000000039-CreateDespesaParcelaPagamentos");
const _1700000000040_CreateCobrancasBancarias_1 = require("../migrations/1700000000040-CreateCobrancasBancarias");
const _1700000000041_CreateReguaCobranca_1 = require("../migrations/1700000000041-CreateReguaCobranca");
const _1700000000042_CreateOrcamentosLoteamento_1 = require("../migrations/1700000000042-CreateOrcamentosLoteamento");
const _1700000000043_CreateFechamentosFinanceiros_1 = require("../migrations/1700000000043-CreateFechamentosFinanceiros");
const _1700000000044_AddPermissoesFinanceiras_1 = require("../migrations/1700000000044-AddPermissoesFinanceiras");
const _1700000000045_AddComprovantesFinanceiros_1 = require("../migrations/1700000000045-AddComprovantesFinanceiros");
const _1700000000046_AddRetencoesServicos_1 = require("../migrations/1700000000046-AddRetencoesServicos");
const _1700000000047_AddComissaoVenda_1 = require("../migrations/1700000000047-AddComissaoVenda");
const _1700000000048_CreateVendaAcordos_1 = require("../migrations/1700000000048-CreateVendaAcordos");
const _1700000000049_CreateRelatoriosFechamento_1 = require("../migrations/1700000000049-CreateRelatoriosFechamento");
const _1700000000050_AddContaFechamentoFinanceiro_1 = require("../migrations/1700000000050-AddContaFechamentoFinanceiro");
exports.AppDataSource = new typeorm_1.DataSource({
    type: "postgres",
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 5433),
    username: process.env.DB_USER || "sislote",
    password: process.env.DB_PASSWORD || "sislote",
    database: process.env.DB_NAME || "sislote",
    entities: [Cliente_1.Cliente, Loteamento_1.Loteamento, Lote_1.Lote, Conta_1.Conta, Usuario_1.Usuario, Venda_1.Venda, Pagamento_1.Pagamento, Log_1.Log, Empresa_1.Empresa, Auditoria_1.Auditoria, HubBillingCharge_1.HubBillingCharge, HubBillingEvent_1.HubBillingEvent, Sugestao_1.Sugestao, TelegramConfig_1.TelegramConfig, TelegramNotificacao_1.TelegramNotificacao, LpEvento_1.LpEvento, PlanoDeContas_1.PlanoDeContas, Fornecedor_1.Fornecedor, Despesa_1.Despesa, DespesaParcela_1.DespesaParcela, LancamentoManual_1.LancamentoManual, DespesaRateio_1.DespesaRateio, LancamentoRateio_1.LancamentoRateio, TransferenciaConta_1.TransferenciaConta, CobrancaBancaria_1.CobrancaBancaria, CobrancaRegra_1.CobrancaRegra, CobrancaComunicacao_1.CobrancaComunicacao, OrcamentoLoteamento_1.OrcamentoLoteamento, FechamentoFinanceiro_1.FechamentoFinanceiro, VendaAcordo_1.VendaAcordo, SugestaoMensagem_1.SugestaoMensagem],
    migrations: [
        _1700000000000_CreateClientes_1.CreateClientes1700000000000,
        _1700000000001_CreateCoreTables_1.CreateCoreTables1700000000001,
        _1700000000002_CreateEmpresasAndMultiTenant_1.CreateEmpresasAndMultiTenant1700000000002,
        _1700000000003_AddEmpresaAtivo_1.AddEmpresaAtivo1700000000003,
        _1700000000004_AddProprietarioFieldsToLoteamento_1.AddProprietarioFieldsToLoteamento1700000000004,
        _1700000000005_AddLogoToEmpresa_1.AddLogoToEmpresa1700000000005,
        _1700000000006_MultiTenantEnsureEmpresaGeral_1.MultiTenantEnsureEmpresaGeral1700000000006,
        _1700000000007_FixEmpresasSequence_1.FixEmpresasSequence1700000000007,
        _1700000000008_AddEmailTelefoneToUsuario_1.AddEmailTelefoneToUsuario1700000000008,
        _1700000000009_AddSalarioMinimoAndVendaSnapshots_1.AddSalarioMinimoAndVendaSnapshots1700000000009,
        _1700000000010_CreateAuditoria_1.CreateAuditoria1700000000010,
        _1700000000011_AddAdminFieldsToEmpresa_1.AddAdminFieldsToEmpresa1700000000011,
        _1700000000012_AddHubBillingFieldsToEmpresa_1.AddHubBillingFieldsToEmpresa1700000000012,
        _1700000000013_CreateHubBillingCharges_1.CreateHubBillingCharges1700000000013,
        _1700000000014_CreateHubBillingEvents_1.CreateHubBillingEvents1700000000014,
        _1700000000015_AddWebhookEventIdToHubBillingEvents_1.AddWebhookEventIdToHubBillingEvents1700000000015,
        _1700000000016_AddIgnorePlanControlToEmpresa_1.AddIgnorePlanControlToEmpresa1700000000016,
        _1700000000016_AllowEntradaTipoPagamento_1.AllowEntradaTipoPagamento1700000000016,
        _1700000000017_AddModeloContratoToEmpresa_1.AddModeloContratoToEmpresa1700000000017,
        _1700000000018_FixAllSequences_1.FixAllSequences1700000000018,
        _1700000000019_CreateSugestoes_1.CreateSugestoes1700000000019,
        _1700000000020_AddReajustadoToPagamentos_1.AddReajustadoToPagamentos1700000000020,
        _1700000000021_FixVendaLoteUniqueConstraint_1.FixVendaLoteUniqueConstraint1700000000021,
        _1700000000022_AddEncargosToEmpresa_1.AddEncargosToEmpresa1700000000022,
        _1700000000023_AddAtivoToConta_1.AddAtivoToConta1700000000023,
        _1700000000024_CreateTelegramConfig_1.CreateTelegramConfig1700000000024,
        _1700000000025_CreateTelegramNotificacao_1.CreateTelegramNotificacao1700000000025,
        _1700000000026_CreateLpEvento_1.CreateLpEvento1700000000026,
        _1700000000027_AddLastLoginToUsuario_1.AddLastLoginToUsuario1700000000027,
        _1700000000028_CreateDespesas_1.CreateDespesas1700000000028,
        _1700000000029_AddSaldoLancamentos_1.AddSaldoLancamentos1700000000029,
        _1700000000030_CreatePlanoDeContas_1.CreatePlanoDeContas1700000000030,
        _1700000000031_AddRecorrenciaToDespesas_1.AddRecorrenciaToDespesas1700000000031,
        _1700000000032_AddRateioAndFornecedorLancamento_1.AddRateioAndFornecedorLancamento1700000000032,
        _1700000000033_AddChatAndAnexoToSugestoes_1.AddChatAndAnexoToSugestoes1700000000033,
        _1700000000034_CreateMovimentosFinanceirosView_1.CreateMovimentosFinanceirosView1700000000034,
        _1700000000035_SeedPlanoContasReceitas_1.SeedPlanoContasReceitas1700000000035,
        _1700000000036_CreateTransferenciasContas_1.CreateTransferenciasContas1700000000036,
        _1700000000037_CreateConciliacaoBancaria_1.CreateConciliacaoBancaria1700000000037,
        _1700000000038_AddEncargosDespesaParcela_1.AddEncargosDespesaParcela1700000000038,
        _1700000000039_CreateDespesaParcelaPagamentos_1.CreateDespesaParcelaPagamentos1700000000039,
        _1700000000040_CreateCobrancasBancarias_1.CreateCobrancasBancarias1700000000040,
        _1700000000041_CreateReguaCobranca_1.CreateReguaCobranca1700000000041,
        _1700000000042_CreateOrcamentosLoteamento_1.CreateOrcamentosLoteamento1700000000042,
        _1700000000043_CreateFechamentosFinanceiros_1.CreateFechamentosFinanceiros1700000000043,
        _1700000000044_AddPermissoesFinanceiras_1.AddPermissoesFinanceiras1700000000044,
        _1700000000045_AddComprovantesFinanceiros_1.AddComprovantesFinanceiros1700000000045,
        _1700000000046_AddRetencoesServicos_1.AddRetencoesServicos1700000000046,
        _1700000000047_AddComissaoVenda_1.AddComissaoVenda1700000000047,
        _1700000000048_CreateVendaAcordos_1.CreateVendaAcordos1700000000048,
        _1700000000049_CreateRelatoriosFechamento_1.CreateRelatoriosFechamento1700000000049,
        _1700000000050_AddContaFechamentoFinanceiro_1.AddContaFechamentoFinanceiro1700000000050,
    ],
    synchronize: false,
    logging: false,
});
