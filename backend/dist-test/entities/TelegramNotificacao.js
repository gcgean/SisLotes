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
exports.TelegramNotificacao = void 0;
const typeorm_1 = require("typeorm");
// Registro de deduplicação: garante que cada empresa receba cada tipo de aviso
// (ex.: "trial_vencendo", "trial_expirado") apenas uma vez.
let TelegramNotificacao = class TelegramNotificacao {
};
exports.TelegramNotificacao = TelegramNotificacao;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], TelegramNotificacao.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_empresa" }),
    __metadata("design:type", Number)
], TelegramNotificacao.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 40 }),
    __metadata("design:type", String)
], TelegramNotificacao.prototype, "tipo", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", name: "created_at" }),
    __metadata("design:type", Date)
], TelegramNotificacao.prototype, "created_at", void 0);
exports.TelegramNotificacao = TelegramNotificacao = __decorate([
    (0, typeorm_1.Entity)({ name: "telegram_notificacao" }),
    (0, typeorm_1.Unique)("uq_telegram_notificacao", ["id_empresa", "tipo"])
], TelegramNotificacao);
