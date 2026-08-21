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
exports.Loteamento = void 0;
const typeorm_1 = require("typeorm");
const Lote_1 = require("./Lote");
let Loteamento = class Loteamento {
};
exports.Loteamento = Loteamento;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_loteamento" }),
    __metadata("design:type", Number)
], Loteamento.prototype, "id_loteamento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_empresa" }),
    __metadata("design:type", Number)
], Loteamento.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 200 }),
    __metadata("design:type", String)
], Loteamento.prototype, "nome", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 300, nullable: true }),
    __metadata("design:type", Object)
], Loteamento.prototype, "endereco", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", Object)
], Loteamento.prototype, "cidade", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "char", length: 2, nullable: true }),
    __metadata("design:type", Object)
], Loteamento.prototype, "estado", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "char", length: 1, nullable: true }),
    __metadata("design:type", Object)
], Loteamento.prototype, "tipo_pessoa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 200, nullable: true, name: "prop_nome" }),
    __metadata("design:type", Object)
], Loteamento.prototype, "prop_nome", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 18, nullable: true }),
    __metadata("design:type", Object)
], Loteamento.prototype, "cnpj", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", Object)
], Loteamento.prototype, "rg", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 50, nullable: true }),
    __metadata("design:type", Object)
], Loteamento.prototype, "estado_civil", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 200, nullable: true }),
    __metadata("design:type", Object)
], Loteamento.prototype, "conjuge", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", Object)
], Loteamento.prototype, "profissao", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 300, nullable: true, name: "prop_endereco" }),
    __metadata("design:type", Object)
], Loteamento.prototype, "prop_endereco", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true, name: "prop_bairro" }),
    __metadata("design:type", Object)
], Loteamento.prototype, "prop_bairro", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true, name: "prop_cidade" }),
    __metadata("design:type", Object)
], Loteamento.prototype, "prop_cidade", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "char", length: 2, nullable: true, name: "prop_estado" }),
    __metadata("design:type", Object)
], Loteamento.prototype, "prop_estado", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 9, nullable: true, name: "prop_cep" }),
    __metadata("design:type", Object)
], Loteamento.prototype, "prop_cep", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20, nullable: true, name: "prop_fone" }),
    __metadata("design:type", Object)
], Loteamento.prototype, "prop_fone", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", name: "created_at" }),
    __metadata("design:type", Date)
], Loteamento.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp", name: "updated_at" }),
    __metadata("design:type", Date)
], Loteamento.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Lote_1.Lote, (lote) => lote.loteamento),
    __metadata("design:type", Array)
], Loteamento.prototype, "lotes", void 0);
exports.Loteamento = Loteamento = __decorate([
    (0, typeorm_1.Entity)({ name: "loteamentos" })
], Loteamento);
