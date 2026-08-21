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
exports.FechamentoFinanceiro = void 0;
const typeorm_1 = require("typeorm");
let FechamentoFinanceiro = class FechamentoFinanceiro {
};
exports.FechamentoFinanceiro = FechamentoFinanceiro;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: "bigint" }),
    __metadata("design:type", Number)
], FechamentoFinanceiro.prototype, "id_fechamento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer" }),
    __metadata("design:type", Number)
], FechamentoFinanceiro.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", nullable: true }),
    __metadata("design:type", Object)
], FechamentoFinanceiro.prototype, "id_conta", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "date", nullable: true }),
    __metadata("design:type", Object)
], FechamentoFinanceiro.prototype, "fechado_ate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer" }),
    __metadata("design:type", Number)
], FechamentoFinanceiro.prototype, "id_usuario", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], FechamentoFinanceiro.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], FechamentoFinanceiro.prototype, "updated_at", void 0);
exports.FechamentoFinanceiro = FechamentoFinanceiro = __decorate([
    (0, typeorm_1.Entity)({ name: "fechamentos_financeiros" })
], FechamentoFinanceiro);
