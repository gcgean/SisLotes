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
exports.Auditoria = void 0;
const typeorm_1 = require("typeorm");
const Usuario_1 = require("./Usuario");
let Auditoria = class Auditoria {
};
exports.Auditoria = Auditoria;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Auditoria.prototype, "id_auditoria", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], Auditoria.prototype, "id_usuario", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Usuario_1.Usuario),
    (0, typeorm_1.JoinColumn)({ name: "id_usuario" }),
    __metadata("design:type", Usuario_1.Usuario)
], Auditoria.prototype, "usuario", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Auditoria.prototype, "tabela", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Auditoria.prototype, "id_registro", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Auditoria.prototype, "acao", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], Auditoria.prototype, "valores_antigos", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], Auditoria.prototype, "valores_novos", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Auditoria.prototype, "descricao", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Auditoria.prototype, "ip_address", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Auditoria.prototype, "data_hora", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], Auditoria.prototype, "id_empresa", void 0);
exports.Auditoria = Auditoria = __decorate([
    (0, typeorm_1.Entity)("auditoria")
], Auditoria);
