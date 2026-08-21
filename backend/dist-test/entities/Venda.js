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
exports.Venda = void 0;
const typeorm_1 = require("typeorm");
const Cliente_1 = require("./Cliente");
const Lote_1 = require("./Lote");
const Pagamento_1 = require("./Pagamento");
let Venda = class Venda {
};
exports.Venda = Venda;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_venda" }),
    __metadata("design:type", Number)
], Venda.prototype, "id_venda", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_empresa" }),
    __metadata("design:type", Number)
], Venda.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_cliente" }),
    __metadata("design:type", Number)
], Venda.prototype, "id_cliente", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Cliente_1.Cliente),
    (0, typeorm_1.JoinColumn)({ name: "id_cliente" }),
    __metadata("design:type", Cliente_1.Cliente)
], Venda.prototype, "cliente", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_lote", unique: true }),
    __metadata("design:type", Number)
], Venda.prototype, "id_lote", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Lote_1.Lote),
    (0, typeorm_1.JoinColumn)({ name: "id_lote" }),
    __metadata("design:type", Lote_1.Lote)
], Venda.prototype, "lote", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "date", name: "data_venda" }),
    __metadata("design:type", String)
], Venda.prototype, "data_venda", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, name: "valor_entrada", default: 0 }),
    __metadata("design:type", String)
], Venda.prototype, "valor_entrada", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer" }),
    __metadata("design:type", Number)
], Venda.prototype, "parcelas", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 5, scale: 2, name: "porcentagem", default: 0 }),
    __metadata("design:type", String)
], Venda.prototype, "porcentagem", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 10, scale: 2, name: "salario_minimo_base", nullable: true }),
    __metadata("design:type", Object)
], Venda.prototype, "salario_minimo_base", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 10, scale: 2, name: "valor_parcela", nullable: true }),
    __metadata("design:type", Object)
], Venda.prototype, "valor_parcela", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20, default: "aberta" }),
    __metadata("design:type", String)
], Venda.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_corretor", nullable: true }),
    __metadata("design:type", Object)
], Venda.prototype, "id_corretor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 7, scale: 4, name: "comissao_percentual", nullable: true }),
    __metadata("design:type", Object)
], Venda.prototype, "comissao_percentual", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, name: "comissao_valor", nullable: true }),
    __metadata("design:type", Object)
], Venda.prototype, "comissao_valor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "date", name: "comissao_vencimento", nullable: true }),
    __metadata("design:type", Object)
], Venda.prototype, "comissao_vencimento", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", name: "created_at" }),
    __metadata("design:type", Date)
], Venda.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp", name: "updated_at" }),
    __metadata("design:type", Date)
], Venda.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Pagamento_1.Pagamento, (pagamento) => pagamento.venda),
    __metadata("design:type", Array)
], Venda.prototype, "pagamentos", void 0);
exports.Venda = Venda = __decorate([
    (0, typeorm_1.Entity)({ name: "vendas" }),
    (0, typeorm_1.Index)("idx_vendas_cliente", ["id_cliente"]),
    (0, typeorm_1.Index)("idx_vendas_lote", ["id_lote"])
], Venda);
