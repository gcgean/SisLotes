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
exports.SugestaoMensagem = void 0;
const typeorm_1 = require("typeorm");
const Sugestao_1 = require("./Sugestao");
const Usuario_1 = require("./Usuario");
// Thread de chat (várias mensagens, ida e volta) entre o usuário que abriu a
// sugestão e o gestor da plataforma — substitui o antigo campo único
// "resposta_admin" por uma conversa de verdade.
let SugestaoMensagem = class SugestaoMensagem {
};
exports.SugestaoMensagem = SugestaoMensagem;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_mensagem" }),
    __metadata("design:type", Number)
], SugestaoMensagem.prototype, "id_mensagem", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_sugestao" }),
    __metadata("design:type", Number)
], SugestaoMensagem.prototype, "id_sugestao", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Sugestao_1.Sugestao),
    (0, typeorm_1.JoinColumn)({ name: "id_sugestao" }),
    __metadata("design:type", Sugestao_1.Sugestao)
], SugestaoMensagem.prototype, "sugestao", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_usuario" }),
    __metadata("design:type", Number)
], SugestaoMensagem.prototype, "id_usuario", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Usuario_1.Usuario),
    (0, typeorm_1.JoinColumn)({ name: "id_usuario" }),
    __metadata("design:type", Usuario_1.Usuario)
], SugestaoMensagem.prototype, "usuario", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", name: "autor_admin", default: false }),
    __metadata("design:type", Boolean)
], SugestaoMensagem.prototype, "autor_admin", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], SugestaoMensagem.prototype, "mensagem", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 200, name: "anexo_nome", nullable: true }),
    __metadata("design:type", Object)
], SugestaoMensagem.prototype, "anexo_nome", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "anexo_base64", nullable: true }),
    __metadata("design:type", Object)
], SugestaoMensagem.prototype, "anexo_base64", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", name: "created_at" }),
    __metadata("design:type", Date)
], SugestaoMensagem.prototype, "created_at", void 0);
exports.SugestaoMensagem = SugestaoMensagem = __decorate([
    (0, typeorm_1.Entity)({ name: "sugestao_mensagens" }),
    (0, typeorm_1.Index)("idx_sugestao_mensagens_sugestao", ["id_sugestao"])
], SugestaoMensagem);
