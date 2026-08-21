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
exports.CobrancaComunicacao = void 0;
const typeorm_1 = require("typeorm");
let CobrancaComunicacao = class CobrancaComunicacao {
};
exports.CobrancaComunicacao = CobrancaComunicacao;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_comunicacao" }),
    __metadata("design:type", Number)
], CobrancaComunicacao.prototype, "id_comunicacao", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer" }),
    __metadata("design:type", Number)
], CobrancaComunicacao.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer" }),
    __metadata("design:type", Number)
], CobrancaComunicacao.prototype, "id_regra", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer" }),
    __metadata("design:type", Number)
], CobrancaComunicacao.prototype, "id_pagamento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 10 }),
    __metadata("design:type", String)
], CobrancaComunicacao.prototype, "canal", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 200, nullable: true }),
    __metadata("design:type", Object)
], CobrancaComunicacao.prototype, "destinatario", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], CobrancaComunicacao.prototype, "mensagem", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20, default: "rascunho" }),
    __metadata("design:type", String)
], CobrancaComunicacao.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", Object)
], CobrancaComunicacao.prototype, "provedor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 150, nullable: true }),
    __metadata("design:type", Object)
], CobrancaComunicacao.prototype, "id_externo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], CobrancaComunicacao.prototype, "erro", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], CobrancaComunicacao.prototype, "created_at", void 0);
exports.CobrancaComunicacao = CobrancaComunicacao = __decorate([
    (0, typeorm_1.Entity)({ name: "cobranca_comunicacoes" }),
    (0, typeorm_1.Index)("idx_cobranca_comunicacoes_empresa_status", ["id_empresa", "status"])
], CobrancaComunicacao);
