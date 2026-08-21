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
exports.Cliente = void 0;
const typeorm_1 = require("typeorm");
let Cliente = class Cliente {
};
exports.Cliente = Cliente;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_cliente" }),
    __metadata("design:type", Number)
], Cliente.prototype, "id_cliente", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_empresa" }),
    __metadata("design:type", Number)
], Cliente.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "char", length: 1 }),
    __metadata("design:type", String)
], Cliente.prototype, "tipo", void 0);
__decorate([
    (0, typeorm_1.Index)("idx_clientes_nome"),
    (0, typeorm_1.Column)({ type: "varchar", length: 200 }),
    __metadata("design:type", String)
], Cliente.prototype, "nome", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 200, nullable: true }),
    __metadata("design:type", Object)
], Cliente.prototype, "razao_social", void 0);
__decorate([
    (0, typeorm_1.Index)("idx_clientes_cpf", { unique: true }),
    (0, typeorm_1.Column)({ type: "varchar", length: 14, nullable: true }),
    __metadata("design:type", Object)
], Cliente.prototype, "cpf", void 0);
__decorate([
    (0, typeorm_1.Index)("idx_clientes_cnpj", { unique: true }),
    (0, typeorm_1.Column)({ type: "varchar", length: 18, nullable: true }),
    __metadata("design:type", Object)
], Cliente.prototype, "cnpj", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", Object)
], Cliente.prototype, "rg", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 30, nullable: true }),
    __metadata("design:type", Object)
], Cliente.prototype, "estado_civil", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 200, nullable: true }),
    __metadata("design:type", Object)
], Cliente.prototype, "conjuge", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", Object)
], Cliente.prototype, "profissao", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 300, nullable: true }),
    __metadata("design:type", Object)
], Cliente.prototype, "endereco", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", Object)
], Cliente.prototype, "bairro", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", Object)
], Cliente.prototype, "cidade", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "char", length: 2, nullable: true }),
    __metadata("design:type", Object)
], Cliente.prototype, "estado", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 9, nullable: true }),
    __metadata("design:type", Object)
], Cliente.prototype, "cep", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 200, nullable: true }),
    __metadata("design:type", Object)
], Cliente.prototype, "complemento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", Object)
], Cliente.prototype, "fone_res", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20, nullable: true }),
    __metadata("design:type", Object)
], Cliente.prototype, "fone_com", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 200, nullable: true }),
    __metadata("design:type", Object)
], Cliente.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", name: "created_at" }),
    __metadata("design:type", Date)
], Cliente.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp", name: "updated_at" }),
    __metadata("design:type", Date)
], Cliente.prototype, "updated_at", void 0);
exports.Cliente = Cliente = __decorate([
    (0, typeorm_1.Entity)({ name: "clientes" })
], Cliente);
