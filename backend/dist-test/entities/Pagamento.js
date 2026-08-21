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
exports.Pagamento = void 0;
const typeorm_1 = require("typeorm");
const Venda_1 = require("./Venda");
const Conta_1 = require("./Conta");
const Usuario_1 = require("./Usuario");
let Pagamento = class Pagamento {
};
exports.Pagamento = Pagamento;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_pagamento" }),
    __metadata("design:type", Number)
], Pagamento.prototype, "id_pagamento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_empresa" }),
    __metadata("design:type", Number)
], Pagamento.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_venda" }),
    __metadata("design:type", Number)
], Pagamento.prototype, "id_venda", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Venda_1.Venda, (venda) => venda.pagamentos),
    (0, typeorm_1.JoinColumn)({ name: "id_venda" }),
    __metadata("design:type", Venda_1.Venda)
], Pagamento.prototype, "venda", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_conta", nullable: true }),
    __metadata("design:type", Object)
], Pagamento.prototype, "id_conta", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Conta_1.Conta, (conta) => conta.pagamentos),
    (0, typeorm_1.JoinColumn)({ name: "id_conta" }),
    __metadata("design:type", Object)
], Pagamento.prototype, "conta", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_usuario", nullable: true }),
    __metadata("design:type", Object)
], Pagamento.prototype, "id_usuario", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Usuario_1.Usuario, (usuario) => usuario.pagamentos),
    (0, typeorm_1.JoinColumn)({ name: "id_usuario" }),
    __metadata("design:type", Object)
], Pagamento.prototype, "usuario", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "numero_parcela" }),
    __metadata("design:type", Number)
], Pagamento.prototype, "numero_parcela", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 10, default: "boleto" }),
    __metadata("design:type", String)
], Pagamento.prototype, "tipo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 10, default: "aberto" }),
    __metadata("design:type", String)
], Pagamento.prototype, "situacao", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "date" }),
    __metadata("design:type", String)
], Pagamento.prototype, "vencimento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2 }),
    __metadata("design:type", String)
], Pagamento.prototype, "valor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "date", name: "pago_data", nullable: true }),
    __metadata("design:type", Object)
], Pagamento.prototype, "pago_data", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, name: "valor_pago", nullable: true }),
    __metadata("design:type", Object)
], Pagamento.prototype, "valor_pago", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", String)
], Pagamento.prototype, "multa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, default: 0 }),
    __metadata("design:type", String)
], Pagamento.prototype, "juros", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", name: "reajustado", default: false }),
    __metadata("design:type", Boolean)
], Pagamento.prototype, "reajustado", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", name: "created_at" }),
    __metadata("design:type", Date)
], Pagamento.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp", name: "updated_at" }),
    __metadata("design:type", Date)
], Pagamento.prototype, "updated_at", void 0);
exports.Pagamento = Pagamento = __decorate([
    (0, typeorm_1.Entity)({ name: "pagamentos" }),
    (0, typeorm_1.Unique)("uq_pagamentos_venda_parcela", ["id_venda", "numero_parcela"]),
    (0, typeorm_1.Index)("idx_pagamentos_venda", ["id_venda"]),
    (0, typeorm_1.Index)("idx_pagamentos_vencimento", ["vencimento"]),
    (0, typeorm_1.Index)("idx_pagamentos_situacao", ["situacao"])
], Pagamento);
