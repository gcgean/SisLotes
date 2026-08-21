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
exports.CobrancaBancaria = void 0;
const typeorm_1 = require("typeorm");
let CobrancaBancaria = class CobrancaBancaria {
};
exports.CobrancaBancaria = CobrancaBancaria;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_cobranca" }),
    __metadata("design:type", Number)
], CobrancaBancaria.prototype, "id_cobranca", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer" }),
    __metadata("design:type", Number)
], CobrancaBancaria.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", nullable: true }),
    __metadata("design:type", Object)
], CobrancaBancaria.prototype, "id_pagamento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", nullable: true }),
    __metadata("design:type", Object)
], CobrancaBancaria.prototype, "id_conta", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 10 }),
    __metadata("design:type", String)
], CobrancaBancaria.prototype, "tipo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 24, default: "rascunho" }),
    __metadata("design:type", String)
], CobrancaBancaria.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 300 }),
    __metadata("design:type", String)
], CobrancaBancaria.prototype, "descricao", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2 }),
    __metadata("design:type", String)
], CobrancaBancaria.prototype, "valor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "date" }),
    __metadata("design:type", String)
], CobrancaBancaria.prototype, "vencimento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 80, nullable: true }),
    __metadata("design:type", Object)
], CobrancaBancaria.prototype, "provedor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 150, nullable: true }),
    __metadata("design:type", Object)
], CobrancaBancaria.prototype, "id_externo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 80, nullable: true }),
    __metadata("design:type", Object)
], CobrancaBancaria.prototype, "nosso_numero", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 200, nullable: true }),
    __metadata("design:type", Object)
], CobrancaBancaria.prototype, "linha_digitavel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], CobrancaBancaria.prototype, "pix_copia_cola", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], CobrancaBancaria.prototype, "payload_provedor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], CobrancaBancaria.prototype, "erro_integracao", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer" }),
    __metadata("design:type", Number)
], CobrancaBancaria.prototype, "id_usuario", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], CobrancaBancaria.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], CobrancaBancaria.prototype, "updated_at", void 0);
exports.CobrancaBancaria = CobrancaBancaria = __decorate([
    (0, typeorm_1.Entity)({ name: "cobrancas_bancarias" }),
    (0, typeorm_1.Index)("idx_cobrancas_empresa_status_vencimento", ["id_empresa", "status", "vencimento"])
], CobrancaBancaria);
