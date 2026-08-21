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
exports.Lote = void 0;
const typeorm_1 = require("typeorm");
const Loteamento_1 = require("./Loteamento");
let Lote = class Lote {
};
exports.Lote = Lote;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_lote" }),
    __metadata("design:type", Number)
], Lote.prototype, "id_lote", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_empresa" }),
    __metadata("design:type", Number)
], Lote.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_loteamento" }),
    __metadata("design:type", Number)
], Lote.prototype, "id_loteamento", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Loteamento_1.Loteamento, (loteamento) => loteamento.lotes),
    (0, typeorm_1.JoinColumn)({ name: "id_loteamento" }),
    __metadata("design:type", Loteamento_1.Loteamento)
], Lote.prototype, "loteamento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20 }),
    __metadata("design:type", String)
], Lote.prototype, "lote", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20 }),
    __metadata("design:type", String)
], Lote.prototype, "quadra", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", Object)
], Lote.prototype, "area", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", Object)
], Lote.prototype, "frente", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", Object)
], Lote.prototype, "fundo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", Object)
], Lote.prototype, "esquerdo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", Object)
], Lote.prototype, "direito", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", name: "created_at" }),
    __metadata("design:type", Date)
], Lote.prototype, "created_at", void 0);
exports.Lote = Lote = __decorate([
    (0, typeorm_1.Entity)({ name: "lotes" }),
    (0, typeorm_1.Index)("idx_lotes_loteamento", ["id_loteamento"]),
    (0, typeorm_1.Index)("uq_lotes_loteamento_quadra_lote", ["id_loteamento", "quadra", "lote"], { unique: true })
], Lote);
