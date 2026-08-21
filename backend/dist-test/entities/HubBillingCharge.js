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
exports.HubBillingCharge = void 0;
const typeorm_1 = require("typeorm");
let HubBillingCharge = class HubBillingCharge {
};
exports.HubBillingCharge = HubBillingCharge;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_hub_charge" }),
    __metadata("design:type", Number)
], HubBillingCharge.prototype, "id_hub_charge", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_empresa" }),
    __metadata("design:type", Number)
], HubBillingCharge.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 40, name: "origin_type" }),
    __metadata("design:type", String)
], HubBillingCharge.prototype, "origin_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, name: "origin_id" }),
    __metadata("design:type", String)
], HubBillingCharge.prototype, "origin_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, name: "order_id", nullable: true }),
    __metadata("design:type", Object)
], HubBillingCharge.prototype, "order_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, name: "subscription_id", nullable: true }),
    __metadata("design:type", Object)
], HubBillingCharge.prototype, "subscription_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 120, name: "charge_id", nullable: true }),
    __metadata("design:type", Object)
], HubBillingCharge.prototype, "charge_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 40, nullable: true }),
    __metadata("design:type", Object)
], HubBillingCharge.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], HubBillingCharge.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", name: "payload", nullable: true }),
    __metadata("design:type", Object)
], HubBillingCharge.prototype, "payload", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", name: "created_at" }),
    __metadata("design:type", Date)
], HubBillingCharge.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp", name: "updated_at" }),
    __metadata("design:type", Date)
], HubBillingCharge.prototype, "updated_at", void 0);
exports.HubBillingCharge = HubBillingCharge = __decorate([
    (0, typeorm_1.Entity)({ name: "hub_billing_charges" }),
    (0, typeorm_1.Index)("idx_hub_charge_empresa", ["id_empresa"]),
    (0, typeorm_1.Index)("idx_hub_charge_charge_id", ["charge_id"])
], HubBillingCharge);
