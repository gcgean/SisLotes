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
exports.LancamentoRateio = void 0;
const typeorm_1 = require("typeorm");
// Rateio de um lançamento manual entre múltiplos loteamentos. Quando existem
// linhas aqui, o campo lancamento.id_loteamento fica nulo.
let LancamentoRateio = class LancamentoRateio {
};
exports.LancamentoRateio = LancamentoRateio;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], LancamentoRateio.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_empresa" }),
    __metadata("design:type", Number)
], LancamentoRateio.prototype, "id_empresa", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_lancamento" }),
    __metadata("design:type", Number)
], LancamentoRateio.prototype, "id_lancamento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "integer", name: "id_loteamento" }),
    __metadata("design:type", Number)
], LancamentoRateio.prototype, "id_loteamento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 5, scale: 2 }),
    __metadata("design:type", String)
], LancamentoRateio.prototype, "percentual", void 0);
exports.LancamentoRateio = LancamentoRateio = __decorate([
    (0, typeorm_1.Entity)({ name: "lancamento_rateio" }),
    (0, typeorm_1.Index)("idx_lancamento_rateio_lancamento", ["id_lancamento"])
], LancamentoRateio);
