"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Empresa = void 0;
const typeorm_1 = require("typeorm");
let Empresa = class Empresa {
};
exports.Empresa = Empresa;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_empresa" }),
    __metadata("design:type", Number)
], Empresa.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 200 }),
    __metadata("design:type", String)
], Empresa.prototype, "nome_fantasia", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 200, nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "razao_social", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 18, nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "cnpj", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "ie", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 300, nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "endereco", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "bairro", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "cidade", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "char", length: 2, nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "estado", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 9, nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "cep", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "telefone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 200, nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 200, nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "site", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 10, scale: 2, name: "salario_minimo", nullable: true, default: 0 }),
    __metadata("design:type", Object)
], Empresa.prototype, "salario_minimo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "logo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], Empresa.prototype, "ativo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", name: "ignorar_controle_planos", default: false }),
    __metadata("design:type", Boolean)
], Empresa.prototype, "ignorar_controle_planos", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 50, nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "plano", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "date", name: "data_vencimento", nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "data_vencimento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 80, name: "hub_customer_id", nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "hub_customer_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 80, name: "hub_product_code", nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "hub_product_code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 40, name: "hub_license_status", nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "hub_license_status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 80, name: "hub_license_reason", nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "hub_license_reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", name: "hub_expires_at", nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "hub_expires_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", name: "hub_features", nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "hub_features", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", name: "hub_last_sync", nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "hub_last_sync", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", name: "hub_cache_until", nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "hub_cache_until", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", name: "ultimo_acesso", nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "ultimo_acesso", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 5, scale: 2, name: "multa_percentual", default: 2.00 }),
    __metadata("design:type", String)
], Empresa.prototype, "multa_percentual", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 5, scale: 4, name: "juros_percentual_dia", default: 0.2000 }),
    __metadata("design:type", String)
], Empresa.prototype, "juros_percentual_dia", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "carencia_dias", default: 0 }),
    __metadata("design:type", Number)
], Empresa.prototype, "carencia_dias", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "modelo_contrato", nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "modelo_contrato", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], Empresa.prototype, "observacoes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", name: "created_at" }),
    __metadata("design:type", Date)
], Empresa.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp", name: "updated_at" }),
    __metadata("design:type", Date)
], Empresa.prototype, "updated_at", void 0);
exports.Empresa = Empresa = __decorate([
    (0, typeorm_1.Entity)({ name: "empresas" })
], Empresa);
