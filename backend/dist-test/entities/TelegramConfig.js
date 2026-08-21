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
exports.TelegramConfig = void 0;
const typeorm_1 = require("typeorm");
// Configuração única da plataforma (linha fixa id = 1) para notificações via Telegram.
let TelegramConfig = class TelegramConfig {
};
exports.TelegramConfig = TelegramConfig;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: "integer", default: 1 }),
    __metadata("design:type", Number)
], TelegramConfig.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], TelegramConfig.prototype, "ativo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "bot_token", nullable: true }),
    __metadata("design:type", Object)
], TelegramConfig.prototype, "bot_token", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", name: "notificar_novo_lead", default: true }),
    __metadata("design:type", Boolean)
], TelegramConfig.prototype, "notificar_novo_lead", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", name: "notificar_pagamento", default: true }),
    __metadata("design:type", Boolean)
], TelegramConfig.prototype, "notificar_pagamento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", name: "notificar_trial", default: true }),
    __metadata("design:type", Boolean)
], TelegramConfig.prototype, "notificar_trial", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], TelegramConfig.prototype, "recipients", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp", name: "updated_at" }),
    __metadata("design:type", Date)
], TelegramConfig.prototype, "updated_at", void 0);
exports.TelegramConfig = TelegramConfig = __decorate([
    (0, typeorm_1.Entity)({ name: "telegram_config" })
], TelegramConfig);
