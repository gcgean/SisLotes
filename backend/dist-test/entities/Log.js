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
exports.Log = void 0;
const typeorm_1 = require("typeorm");
const Usuario_1 = require("./Usuario");
const Cliente_1 = require("./Cliente");
const Lote_1 = require("./Lote");
let Log = class Log {
};
exports.Log = Log;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_log" }),
    __metadata("design:type", Number)
], Log.prototype, "id_log", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_usuario" }),
    __metadata("design:type", Number)
], Log.prototype, "id_usuario", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Usuario_1.Usuario, (usuario) => usuario.logs),
    (0, typeorm_1.JoinColumn)({ name: "id_usuario" }),
    __metadata("design:type", Usuario_1.Usuario)
], Log.prototype, "usuario", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_cliente", nullable: true }),
    __metadata("design:type", Object)
], Log.prototype, "id_cliente", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Cliente_1.Cliente),
    (0, typeorm_1.JoinColumn)({ name: "id_cliente" }),
    __metadata("design:type", Object)
], Log.prototype, "cliente", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_lote", nullable: true }),
    __metadata("design:type", Object)
], Log.prototype, "id_lote", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Lote_1.Lote),
    (0, typeorm_1.JoinColumn)({ name: "id_lote" }),
    __metadata("design:type", Object)
], Log.prototype, "lote", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", Object)
], Log.prototype, "servico", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 500, nullable: true }),
    __metadata("design:type", Object)
], Log.prototype, "url", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], Log.prototype, "log", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], Log.prototype, "query", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", name: "data_hora" }),
    __metadata("design:type", Date)
], Log.prototype, "data_hora", void 0);
exports.Log = Log = __decorate([
    (0, typeorm_1.Entity)({ name: "logs" }),
    (0, typeorm_1.Index)("idx_logs_usuario", ["id_usuario"]),
    (0, typeorm_1.Index)("idx_logs_data", ["data_hora"])
], Log);
