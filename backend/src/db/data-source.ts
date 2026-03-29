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

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5433),
  username: process.env.DB_USER || "sislote",
  password: process.env.DB_PASSWORD || "sislote",
  database: process.env.DB_NAME || "sislote",
  entities: [Cliente, Loteamento, Lote, Conta, Usuario, Venda, Pagamento, Log, Empresa, Auditoria, HubBillingCharge, HubBillingEvent],
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
  ],
  synchronize: false,
  logging: false,
});
