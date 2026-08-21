"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashOfx = void 0;
exports.parseOfx = parseOfx;
const node_crypto_1 = require("node:crypto");
const tag = (bloco, nome) => bloco.match(new RegExp(`<${nome}>\\s*([^<\\r\\n]+)`, "i"))?.[1]?.trim() ?? "";
function parseOfx(conteudo) {
    if (Buffer.byteLength(conteudo, "utf8") > 2 * 1024 * 1024)
        throw new Error("Arquivo OFX excede 2 MB.");
    const blocos = conteudo.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) ?? conteudo.match(/<STMTTRN>[\s\S]*?(?=<STMTTRN>|<\/BANKTRANLIST>)/gi) ?? [];
    const itens = blocos.map((bloco, indice) => {
        const bruto = Number(tag(bloco, "TRNAMT").replace(",", "."));
        const dataBruta = tag(bloco, "DTPOSTED").slice(0, 8);
        if (!Number.isFinite(bruto) || bruto === 0 || !/^\d{8}$/.test(dataBruta))
            throw new Error(`Transação OFX inválida na posição ${indice + 1}.`);
        const data = `${dataBruta.slice(0, 4)}-${dataBruta.slice(4, 6)}-${dataBruta.slice(6, 8)}`;
        const descricao = (tag(bloco, "MEMO") || tag(bloco, "NAME") || "Movimento bancário").slice(0, 500);
        const fallback = (0, node_crypto_1.createHash)("sha256").update(`${data}|${bruto}|${descricao}|${indice}`).digest("hex");
        return { fitid: (tag(bloco, "FITID") || fallback).slice(0, 255), data, tipo: bruto > 0 ? "receita" : "despesa", valor: Math.abs(bruto), descricao };
    });
    if (!itens.length)
        throw new Error("Nenhuma transação encontrada no arquivo OFX.");
    return itens;
}
const hashOfx = (conteudo) => (0, node_crypto_1.createHash)("sha256").update(conteudo).digest("hex");
exports.hashOfx = hashOfx;
