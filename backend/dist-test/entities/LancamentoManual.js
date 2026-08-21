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
exports.LancamentoManual = void 0;
const typeorm_1 = require("typeorm");
let LancamentoManual = class LancamentoManual {
};
exports.LancamentoManual = LancamentoManual;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_lancamento" }),
    __metadata("design:type", Number)
], LancamentoManual.prototype, "id_lancamento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_empresa" }),
    __metadata("design:type", Number)
], LancamentoManual.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_conta" }),
    __metadata("design:type", Number)
], LancamentoManual.prototype, "id_conta", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_loteamento", nullable: true }),
    __metadata("design:type", Object)
], LancamentoManual.prototype, "id_loteamento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 10 }),
    __metadata("design:type", String)
], LancamentoManual.prototype, "tipo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_conta_contabil", nullable: true }),
    __metadata("design:type", Object)
], LancamentoManual.prototype, "id_conta_contabil", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_fornecedor", nullable: true }),
    __metadata("design:type", Object)
], LancamentoManual.prototype, "id_fornecedor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 300 }),
    __metadata("design:type", String)
], LancamentoManual.prototype, "descricao", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2 }),
    __metadata("design:type", String)
], LancamentoManual.prototype, "valor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "date" }),
    __metadata("design:type", String)
], LancamentoManual.prototype, "data", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_usuario" }),
    __metadata("design:type", Number)
], LancamentoManual.prototype, "id_usuario", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 200, name: "anexo_nome", nullable: true }),
    __metadata("design:type", Object)
], LancamentoManual.prototype, "anexo_nome", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "anexo_base64", nullable: true }),
    __metadata("design:type", Object)
], LancamentoManual.prototype, "anexo_base64", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", name: "created_at" }),
    __metadata("design:type", Date)
], LancamentoManual.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp", name: "updated_at" }),
    __metadata("design:type", Date)
], LancamentoManual.prototype, "updated_at", void 0);
exports.LancamentoManual = LancamentoManual = __decorate([
    (0, typeorm_1.Entity)({ name: "lancamentos_manuais" }),
    (0, typeorm_1.Index)("idx_lancamentos_conta", ["id_conta"]),
    (0, typeorm_1.Index)("idx_lancamentos_data", ["data"]),
    (0, typeorm_1.Index)("idx_lancamentos_tipo", ["tipo"])
], LancamentoManual);
