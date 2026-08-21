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
exports.Despesa = void 0;
const typeorm_1 = require("typeorm");
const DespesaParcela_1 = require("./DespesaParcela");
let Despesa = class Despesa {
};
exports.Despesa = Despesa;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_despesa" }),
    __metadata("design:type", Number)
], Despesa.prototype, "id_despesa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_empresa" }),
    __metadata("design:type", Number)
], Despesa.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_loteamento", nullable: true }),
    __metadata("design:type", Object)
], Despesa.prototype, "id_loteamento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_categoria" }),
    __metadata("design:type", Number)
], Despesa.prototype, "id_categoria", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_fornecedor", nullable: true }),
    __metadata("design:type", Object)
], Despesa.prototype, "id_fornecedor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_venda_origem", nullable: true }),
    __metadata("design:type", Object)
], Despesa.prototype, "id_venda_origem", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 300 }),
    __metadata("design:type", String)
], Despesa.prototype, "descricao", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, name: "valor_total" }),
    __metadata("design:type", String)
], Despesa.prototype, "valor_total", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "numero_parcelas", default: 1 }),
    __metadata("design:type", Number)
], Despesa.prototype, "numero_parcelas", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], Despesa.prototype, "recorrente", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", name: "recorrencia_ativa", default: true }),
    __metadata("design:type", Boolean)
], Despesa.prototype, "recorrencia_ativa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 60, nullable: true }),
    __metadata("design:type", Object)
], Despesa.prototype, "documento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 200, name: "anexo_nome", nullable: true }),
    __metadata("design:type", Object)
], Despesa.prototype, "anexo_nome", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "anexo_base64", nullable: true }),
    __metadata("design:type", Object)
], Despesa.prototype, "anexo_base64", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], Despesa.prototype, "observacoes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", name: "created_at" }),
    __metadata("design:type", Date)
], Despesa.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp", name: "updated_at" }),
    __metadata("design:type", Date)
], Despesa.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => DespesaParcela_1.DespesaParcela, (parcela) => parcela.despesa),
    __metadata("design:type", Array)
], Despesa.prototype, "parcelas", void 0);
exports.Despesa = Despesa = __decorate([
    (0, typeorm_1.Entity)({ name: "despesas" })
], Despesa);
