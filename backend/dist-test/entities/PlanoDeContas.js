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
exports.PlanoDeContas = void 0;
const typeorm_1 = require("typeorm");
let PlanoDeContas = class PlanoDeContas {
};
exports.PlanoDeContas = PlanoDeContas;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_conta_contabil" }),
    __metadata("design:type", Number)
], PlanoDeContas.prototype, "id_conta_contabil", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_empresa" }),
    __metadata("design:type", Number)
], PlanoDeContas.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_pai", nullable: true }),
    __metadata("design:type", Object)
], PlanoDeContas.prototype, "id_pai", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 10 }),
    __metadata("design:type", String)
], PlanoDeContas.prototype, "tipo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20 }),
    __metadata("design:type", String)
], PlanoDeContas.prototype, "codigo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 150 }),
    __metadata("design:type", String)
], PlanoDeContas.prototype, "nome", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], PlanoDeContas.prototype, "ativo", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", name: "created_at" }),
    __metadata("design:type", Date)
], PlanoDeContas.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp", name: "updated_at" }),
    __metadata("design:type", Date)
], PlanoDeContas.prototype, "updated_at", void 0);
exports.PlanoDeContas = PlanoDeContas = __decorate([
    (0, typeorm_1.Entity)({ name: "plano_de_contas" })
], PlanoDeContas);
