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
exports.OrcamentoLoteamento = void 0;
const typeorm_1 = require("typeorm");
let OrcamentoLoteamento = class OrcamentoLoteamento {
};
exports.OrcamentoLoteamento = OrcamentoLoteamento;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_orcamento" }),
    __metadata("design:type", Number)
], OrcamentoLoteamento.prototype, "id_orcamento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer" }),
    __metadata("design:type", Number)
], OrcamentoLoteamento.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer" }),
    __metadata("design:type", Number)
], OrcamentoLoteamento.prototype, "id_loteamento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer" }),
    __metadata("design:type", Number)
], OrcamentoLoteamento.prototype, "id_conta_contabil", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "date" }),
    __metadata("design:type", String)
], OrcamentoLoteamento.prototype, "mes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 14, scale: 2 }),
    __metadata("design:type", String)
], OrcamentoLoteamento.prototype, "valor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer" }),
    __metadata("design:type", Number)
], OrcamentoLoteamento.prototype, "id_usuario", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], OrcamentoLoteamento.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], OrcamentoLoteamento.prototype, "updated_at", void 0);
exports.OrcamentoLoteamento = OrcamentoLoteamento = __decorate([
    (0, typeorm_1.Entity)({ name: "orcamentos_loteamento" }),
    (0, typeorm_1.Unique)("uq_orcamento_lote_conta_mes", ["id_empresa", "id_loteamento", "id_conta_contabil", "mes"]),
    (0, typeorm_1.Index)("idx_orcamentos_empresa_mes", ["id_empresa", "mes"])
], OrcamentoLoteamento);
