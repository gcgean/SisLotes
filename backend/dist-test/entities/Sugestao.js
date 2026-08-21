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
exports.Sugestao = void 0;
const typeorm_1 = require("typeorm");
const Usuario_1 = require("./Usuario");
let Sugestao = class Sugestao {
};
exports.Sugestao = Sugestao;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_sugestao" }),
    __metadata("design:type", Number)
], Sugestao.prototype, "id_sugestao", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_empresa" }),
    __metadata("design:type", Number)
], Sugestao.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_usuario" }),
    __metadata("design:type", Number)
], Sugestao.prototype, "id_usuario", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Usuario_1.Usuario),
    (0, typeorm_1.JoinColumn)({ name: "id_usuario" }),
    __metadata("design:type", Usuario_1.Usuario)
], Sugestao.prototype, "usuario", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 200 }),
    __metadata("design:type", String)
], Sugestao.prototype, "titulo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Sugestao.prototype, "descricao", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20, default: "aberta" }),
    __metadata("design:type", String)
], Sugestao.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "resposta_admin", nullable: true }),
    __metadata("design:type", Object)
], Sugestao.prototype, "resposta_admin", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 200, name: "anexo_nome", nullable: true }),
    __metadata("design:type", Object)
], Sugestao.prototype, "anexo_nome", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "anexo_base64", nullable: true }),
    __metadata("design:type", Object)
], Sugestao.prototype, "anexo_base64", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", name: "created_at" }),
    __metadata("design:type", Date)
], Sugestao.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp", name: "updated_at" }),
    __metadata("design:type", Date)
], Sugestao.prototype, "updated_at", void 0);
exports.Sugestao = Sugestao = __decorate([
    (0, typeorm_1.Entity)({ name: "sugestoes" })
], Sugestao);
