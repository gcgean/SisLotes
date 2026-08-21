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
exports.CobrancaRegra = void 0;
const typeorm_1 = require("typeorm");
let CobrancaRegra = class CobrancaRegra {
};
exports.CobrancaRegra = CobrancaRegra;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_regra" }),
    __metadata("design:type", Number)
], CobrancaRegra.prototype, "id_regra", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer" }),
    __metadata("design:type", Number)
], CobrancaRegra.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100 }),
    __metadata("design:type", String)
], CobrancaRegra.prototype, "nome", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer" }),
    __metadata("design:type", Number)
], CobrancaRegra.prototype, "dias_relativos", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 10 }),
    __metadata("design:type", String)
], CobrancaRegra.prototype, "canal", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 150, nullable: true }),
    __metadata("design:type", Object)
], CobrancaRegra.prototype, "assunto", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], CobrancaRegra.prototype, "mensagem", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], CobrancaRegra.prototype, "ativo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer" }),
    __metadata("design:type", Number)
], CobrancaRegra.prototype, "id_usuario", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], CobrancaRegra.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], CobrancaRegra.prototype, "updated_at", void 0);
exports.CobrancaRegra = CobrancaRegra = __decorate([
    (0, typeorm_1.Entity)({ name: "cobranca_regras" }),
    (0, typeorm_1.Index)("idx_cobranca_regras_empresa_ativo", ["id_empresa", "ativo"])
], CobrancaRegra);
