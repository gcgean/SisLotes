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
exports.TransferenciaConta = void 0;
const typeorm_1 = require("typeorm");
let TransferenciaConta = class TransferenciaConta {
};
exports.TransferenciaConta = TransferenciaConta;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_transferencia" }),
    __metadata("design:type", Number)
], TransferenciaConta.prototype, "id_transferencia", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_empresa" }),
    __metadata("design:type", Number)
], TransferenciaConta.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_conta_origem" }),
    __metadata("design:type", Number)
], TransferenciaConta.prototype, "id_conta_origem", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_conta_destino" }),
    __metadata("design:type", Number)
], TransferenciaConta.prototype, "id_conta_destino", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 300 }),
    __metadata("design:type", String)
], TransferenciaConta.prototype, "descricao", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2 }),
    __metadata("design:type", String)
], TransferenciaConta.prototype, "valor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "date" }),
    __metadata("design:type", String)
], TransferenciaConta.prototype, "data", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_usuario" }),
    __metadata("design:type", Number)
], TransferenciaConta.prototype, "id_usuario", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", name: "created_at" }),
    __metadata("design:type", Date)
], TransferenciaConta.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp", name: "updated_at" }),
    __metadata("design:type", Date)
], TransferenciaConta.prototype, "updated_at", void 0);
exports.TransferenciaConta = TransferenciaConta = __decorate([
    (0, typeorm_1.Entity)({ name: "transferencias_contas" }),
    (0, typeorm_1.Index)("idx_transferencias_empresa_data", ["id_empresa", "data"])
], TransferenciaConta);
