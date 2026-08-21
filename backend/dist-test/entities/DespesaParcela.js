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
exports.DespesaParcela = void 0;
const typeorm_1 = require("typeorm");
const Despesa_1 = require("./Despesa");
let DespesaParcela = class DespesaParcela {
};
exports.DespesaParcela = DespesaParcela;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_despesa_parcela" }),
    __metadata("design:type", Number)
], DespesaParcela.prototype, "id_despesa_parcela", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_empresa" }),
    __metadata("design:type", Number)
], DespesaParcela.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_despesa" }),
    __metadata("design:type", Number)
], DespesaParcela.prototype, "id_despesa", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Despesa_1.Despesa, (despesa) => despesa.parcelas),
    (0, typeorm_1.JoinColumn)({ name: "id_despesa" }),
    __metadata("design:type", Despesa_1.Despesa)
], DespesaParcela.prototype, "despesa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "numero_parcela" }),
    __metadata("design:type", Number)
], DespesaParcela.prototype, "numero_parcela", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "date" }),
    __metadata("design:type", String)
], DespesaParcela.prototype, "vencimento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2 }),
    __metadata("design:type", String)
], DespesaParcela.prototype, "valor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 10, default: "aberto" }),
    __metadata("design:type", String)
], DespesaParcela.prototype, "situacao", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "date", name: "pago_data", nullable: true }),
    __metadata("design:type", Object)
], DespesaParcela.prototype, "pago_data", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, name: "valor_pago", nullable: true }),
    __metadata("design:type", Object)
], DespesaParcela.prototype, "valor_pago", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, name: "multa_paga", default: 0 }),
    __metadata("design:type", String)
], DespesaParcela.prototype, "multa_paga", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, name: "juros_pagos", default: 0 }),
    __metadata("design:type", String)
], DespesaParcela.prototype, "juros_pagos", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, name: "desconto_obtido", default: 0 }),
    __metadata("design:type", String)
], DespesaParcela.prototype, "desconto_obtido", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, name: "iss_retido", default: 0 }),
    __metadata("design:type", String)
], DespesaParcela.prototype, "iss_retido", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, name: "irrf_retido", default: 0 }),
    __metadata("design:type", String)
], DespesaParcela.prototype, "irrf_retido", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, name: "inss_retido", default: 0 }),
    __metadata("design:type", String)
], DespesaParcela.prototype, "inss_retido", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_conta", nullable: true }),
    __metadata("design:type", Object)
], DespesaParcela.prototype, "id_conta", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_usuario", nullable: true }),
    __metadata("design:type", Object)
], DespesaParcela.prototype, "id_usuario", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", name: "created_at" }),
    __metadata("design:type", Date)
], DespesaParcela.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp", name: "updated_at" }),
    __metadata("design:type", Date)
], DespesaParcela.prototype, "updated_at", void 0);
exports.DespesaParcela = DespesaParcela = __decorate([
    (0, typeorm_1.Entity)({ name: "despesa_parcelas" }),
    (0, typeorm_1.Index)("idx_despesa_parcelas_despesa", ["id_despesa"]),
    (0, typeorm_1.Index)("idx_despesa_parcelas_vencimento", ["vencimento"]),
    (0, typeorm_1.Index)("idx_despesa_parcelas_situacao", ["situacao"])
], DespesaParcela);
