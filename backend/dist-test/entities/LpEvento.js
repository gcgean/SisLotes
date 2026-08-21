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
exports.LpEvento = void 0;
const typeorm_1 = require("typeorm");
// Evento de rastreamento da landing page de vendas (/lp).
// tipo: 'pageview' | 'section' | 'cta' | 'exit'
let LpEvento = class LpEvento {
};
exports.LpEvento = LpEvento;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], LpEvento.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 40, name: "visitor_id", nullable: true }),
    __metadata("design:type", Object)
], LpEvento.prototype, "visitor_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 40, name: "session_id", nullable: true }),
    __metadata("design:type", Object)
], LpEvento.prototype, "session_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20 }),
    __metadata("design:type", String)
], LpEvento.prototype, "tipo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 40, nullable: true }),
    __metadata("design:type", Object)
], LpEvento.prototype, "secao", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 40, nullable: true }),
    __metadata("design:type", Object)
], LpEvento.prototype, "cta", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], LpEvento.prototype, "referrer", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 80, name: "utm_source", nullable: true }),
    __metadata("design:type", Object)
], LpEvento.prototype, "utm_source", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 80, name: "utm_medium", nullable: true }),
    __metadata("design:type", Object)
], LpEvento.prototype, "utm_medium", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 80, name: "utm_campaign", nullable: true }),
    __metadata("design:type", Object)
], LpEvento.prototype, "utm_campaign", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", Object)
], LpEvento.prototype, "device", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", name: "user_agent", nullable: true }),
    __metadata("design:type", Object)
], LpEvento.prototype, "user_agent", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 50, nullable: true }),
    __metadata("design:type", Object)
], LpEvento.prototype, "ip", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", nullable: true }),
    __metadata("design:type", Object)
], LpEvento.prototype, "duracao", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "scroll_pct", nullable: true }),
    __metadata("design:type", Object)
], LpEvento.prototype, "scroll_pct", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", name: "created_at", default: () => "NOW()" }),
    __metadata("design:type", Date)
], LpEvento.prototype, "created_at", void 0);
exports.LpEvento = LpEvento = __decorate([
    (0, typeorm_1.Entity)({ name: "lp_evento" }),
    (0, typeorm_1.Index)("idx_lp_evento_created", ["created_at"]),
    (0, typeorm_1.Index)("idx_lp_evento_tipo", ["tipo"]),
    (0, typeorm_1.Index)("idx_lp_evento_session", ["session_id"])
], LpEvento);
