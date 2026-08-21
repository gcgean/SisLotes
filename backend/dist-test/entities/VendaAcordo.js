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
exports.VendaAcordo = void 0;
const typeorm_1 = require("typeorm");
let VendaAcordo = class VendaAcordo {
};
exports.VendaAcordo = VendaAcordo;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ name: "id_acordo" }),
    __metadata("design:type", Number)
], VendaAcordo.prototype, "id_acordo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_empresa" }),
    __metadata("design:type", Number)
], VendaAcordo.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_venda" }),
    __metadata("design:type", Number)
], VendaAcordo.prototype, "id_venda", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 20 }),
    __metadata("design:type", String)
], VendaAcordo.prototype, "tipo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], VendaAcordo.prototype, "motivo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", name: "snapshot_antes" }),
    __metadata("design:type", Object)
], VendaAcordo.prototype, "snapshot_antes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "jsonb", name: "snapshot_depois" }),
    __metadata("design:type", Object)
], VendaAcordo.prototype, "snapshot_depois", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_usuario" }),
    __metadata("design:type", Number)
], VendaAcordo.prototype, "id_usuario", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", name: "created_at" }),
    __metadata("design:type", Date)
], VendaAcordo.prototype, "created_at", void 0);
exports.VendaAcordo = VendaAcordo = __decorate([
    (0, typeorm_1.Entity)({ name: "venda_acordos" }),
    (0, typeorm_1.Index)("idx_venda_acordos_venda", ["id_venda"])
], VendaAcordo);
