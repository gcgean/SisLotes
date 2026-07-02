import "reflect-metadata";
import { DataSource } from "typeorm";
import { Cliente } from "../entities/Cliente";
import { Loteamento } from "../entities/Loteamento";
import { Lote } from "../entities/Lote";
import { Conta } from "../entities/Conta";
import { Usuario } from "../entities/Usuario";
import { Venda } from "../entities/Venda";
import { Pagamento } from "../entities/Pagamento";
import { Log } from "../entities/Log";
import { Empresa } from "../entities/Empresa";
import { Auditoria } from "../entities/Auditoria";
import { HubBillingCharge } from "../entities/HubBillingCharge";
import { HubBillingEvent } from "../entities/HubBillingEvent";
import { Sugestao } from "../entities/Sugestao";
import { TelegramConfig } from "../entities/TelegramConfig";
import { CreateClientes1700000000000 } from "../migrations/1700000000000-CreateClientes";
import { CreateCoreTables1700000000001 } from "../migrations/1700000000001-CreateCoreTables";
import { CreateEmpresasAndMultiTenant1700000000002 } from "../migrations/1700000000002-CreateEmpresasAndMultiTenant";
import { AddEmpresaAtivo1700000000003 } from "../migrations/1700000000003-AddEmpresaAtivo";
import { AddProprietarioFieldsToLoteamento1700000000004 } from "../migrations/1700000000004-AddProprietarioFieldsToLoteamento";
import { AddLogoToEmpresa1700000000005 } from "../migrations/1700000000005-AddLogoToEmpresa";
import { MultiTenantEnsureEmpresaGeral1700000000006 } from "../migrations/1700000000006-MultiTenantEnsureEmpresaGeral";
import { FixEmpresasSequence1700000000007 } from "../migrations/1700000000007-FixEmpresasSequence";
import { AddEmailTelefoneToUsuario1700000000008 } from "../migrations/1700000000008-AddEmailTelefoneToUsuario";
import { AddSalarioMinimoAndVendaSnapshots1700000000009 } from "../migrations/1700000000009-AddSalarioMinimoAndVendaSnapshots";
import { CreateAuditoria1700000000010 } from "../migrations/1700000000010-CreateAuditoria";
import { AddAdminFieldsToEmpresa1700000000011 } from "../migrations/1700000000011-AddAdminFieldsToEmpresa";
import { AddHubBillingFieldsToEmpresa1700000000012 } from "../migrations/1700000000012-AddHubBillingFieldsToEmpresa";
import { CreateHubBillingCharges1700000000013 } from "../migrations/1700000000013-CreateHubBillingCharges";
import { CreateHubBillingEvents1700000000014 } from "../migrations/1700000000014-CreateHubBillingEvents";
import { AddWebhookEventIdToHubBillingEvents1700000000015 } from "../migrations/1700000000015-AddWebhookEventIdToHubBillingEvents";
import { AddIgnorePlanControlToEmpresa1700000000016 } from "../migrations/1700000000016-AddIgnorePlanControlToEmpresa";
import { AllowEntradaTipoPagamento1700000000016 } from "../migrations/1700000000016-AllowEntradaTipoPagamento";
import { AddModeloContratoToEmpresa1700000000017 } from "../migrations/1700000000017-AddModeloContratoToEmpresa";
import { FixAllSequences1700000000018 } from "../migrations/1700000000018-FixAllSequences";
import { CreateSugestoes1700000000019 } from "../migrations/1700000000019-CreateSugestoes";
import { AddReajustadoToPagamentos1700000000020 } from "../migrations/1700000000020-AddReajustadoToPagamentos";
import { FixVendaLoteUniqueConstraint1700000000021 } from "../migrations/1700000000021-FixVendaLoteUniqueConstraint";
import { AddEncargosToEmpresa1700000000022 } from "../migrations/1700000000022-AddEncargosToEmpresa";
import { AddAtivoToConta1700000000023 } from "../migrations/1700000000023-AddAtivoToConta";
import { CreateTelegramConfig1700000000024 } from "../migrations/1700000000024-CreateTelegramConfig";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 5433),
  username: process.env.DB_USER || "sislote",
  password: process.env.DB_PASSWORD || "sislote",
  database: process.env.DB_NAME || "sislote",
  entities: [Cliente, Loteamento, Lote, Conta, Usuario, Venda, Pagamento, Log, Empresa, Auditoria, HubBillingCharge, HubBillingEvent, Sugestao, TelegramConfig],
  migrations: [
    CreateClientes1700000000000,
    CreateCoreTables1700000000001,
    CreateEmpresasAndMultiTenant1700000000002,
    AddEmpresaAtivo1700000000003,
    AddProprietarioFieldsToLoteamento1700000000004,
    AddLogoToEmpresa1700000000005,
    MultiTenantEnsureEmpresaGeral1700000000006,
    FixEmpresasSequence1700000000007,
    AddEmailTelefoneToUsuario1700000000008,
    AddSalarioMinimoAndVendaSnapshots1700000000009,
    CreateAuditoria1700000000010,
    AddAdminFieldsToEmpresa1700000000011,
    AddHubBillingFieldsToEmpresa1700000000012,
    CreateHubBillingCharges1700000000013,
    CreateHubBillingEvents1700000000014,
    AddWebhookEventIdToHubBillingEvents1700000000015,
    AddIgnorePlanControlToEmpresa1700000000016,
    AllowEntradaTipoPagamento1700000000016,
    AddModeloContratoToEmpresa1700000000017,
    FixAllSequences1700000000018,
    CreateSugestoes1700000000019,
    AddReajustadoToPagamentos1700000000020,
    FixVendaLoteUniqueConstraint1700000000021,
    AddEncargosToEmpresa1700000000022,
    AddAtivoToConta1700000000023,
    CreateTelegramConfig1700000000024,
  ],
  synchronize: false,
  logging: false,
});
