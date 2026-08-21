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
exports.Conta = void 0;
const typeorm_1 = require("typeorm");
const Pagamento_1 = require("./Pagamento");
let Conta = class Conta {
};
exports.Conta = Conta;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_conta" }),
    __metadata("design:type", Number)
], Conta.prototype, "id_conta", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_empresa" }),
    __metadata("design:type", Number)
], Conta.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100 }),
    __metadata("design:type", String)
], Conta.prototype, "apelido", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 200, nullable: true }),
    __metadata("design:type", Object)
], Conta.prototype, "titular", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", Object)
], Conta.prototype, "agencia", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", Object)
], Conta.prototype, "conta", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 30, nullable: true }),
    __metadata("design:type", Object)
], Conta.prototype, "convenio", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 10, default: "banco" }),
    __metadata("design:type", String)
], Conta.prototype, "tipo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 12, scale: 2, name: "saldo_inicial", default: 0 }),
    __metadata("design:type", String)
], Conta.prototype, "saldo_inicial", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "date", name: "data_saldo_inicial", nullable: true }),
    __metadata("design:type", Object)
], Conta.prototype, "data_saldo_inicial", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], Conta.prototype, "ativo", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", name: "created_at" }),
    __metadata("design:type", Date)
], Conta.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Pagamento_1.Pagamento, (pagamento) => pagamento.conta),
    __metadata("design:type", Array)
], Conta.prototype, "pagamentos", void 0);
exports.Conta = Conta = __decorate([
    (0, typeorm_1.Entity)({ name: "contas" })
], Conta);
