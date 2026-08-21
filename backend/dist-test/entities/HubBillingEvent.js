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
exports.HubBillingEvent = void 0;
const typeorm_1 = require("typeorm");
let HubBillingEvent = class HubBillingEvent {
};
exports.HubBillingEvent = HubBillingEvent;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_hub_event" }),
    __metadata("design:type", Number)
], HubBillingEvent.prototype, "id_hub_event", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_empresa" }),
    __metadata("design:type", Number)
], HubBillingEvent.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 80, name: "event_type" }),
    __metadata("design:type", String)
], HubBillingEvent.prototype, "event_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 30, name: "event_source" }),
    __metadata("design:type", String)
], HubBillingEvent.prototype, "event_source", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 120, name: "charge_id", nullable: true }),
    __metadata("design:type", Object)
], HubBillingEvent.prototype, "charge_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 120, name: "order_id", nullable: true }),
    __metadata("design:type", Object)
], HubBillingEvent.prototype, "order_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 120, name: "subscription_id", nullable: true }),
    __metadata("design:type", Object)
], HubBillingEvent.prototype, "subscription_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 40, nullable: true }),
    __metadata("design:type", Object)
], HubBillingEvent.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], HubBillingEvent.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", nullable: true }),
    __metadata("design:type", Object)
], HubBillingEvent.prototype, "payload", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 120, name: "webhook_event_id", nullable: true, unique: true }),
    __metadata("design:type", Object)
], HubBillingEvent.prototype, "webhook_event_id", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", name: "created_at" }),
    __metadata("design:type", Date)
], HubBillingEvent.prototype, "created_at", void 0);
exports.HubBillingEvent = HubBillingEvent = __decorate([
    (0, typeorm_1.Entity)({ name: "hub_billing_events" }),
    (0, typeorm_1.Index)("idx_hub_event_empresa", ["id_empresa"]),
    (0, typeorm_1.Index)("idx_hub_event_charge_id", ["charge_id"])
], HubBillingEvent);
