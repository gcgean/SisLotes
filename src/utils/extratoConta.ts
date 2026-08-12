// ─── Utilitário: impressão do extrato de conta ───────────────────────────────
// O layout/CSS vem de relatorioBase, compartilhado com os demais relatórios.

import type { ReciboEmpresa } from "./reciboParcela";
import { abrirRelatorio, esc, fmtDataIso, fmtMoeda } from "./relatorioBase";

export interface ExtratoMovimentoImpressao {
  data: string;
  movimento: "entrada" | "saida";
  descricao: string;
  contaContabil: string | null;
  contaApelido: string;
  valor: number;
  saldo: number;
}

export interface ExtratoImpressao {
  contaLabel: string;
  periodoDe: string;
  periodoAte: string;
  saldoInicialPeriodo: number;
  saldoFinalPeriodo: number;
  totalCreditos: number;
  totalDebitos: number;
  movimentos: ExtratoMovimentoImpressao[];
}

export function imprimirExtratoConta(
  extrato: ExtratoImpressao,
  empresa: ReciboEmpresa | null,
  comTimbrado: boolean = true,
) {
  const linhas = extrato.movimentos
    .map((m) => {
      const sinal = m.movimento === "entrada" ? "+" : "−";
      const cor = m.movimento === "entrada" ? "#047857" : "#b91c1c";
      return `
      <tr>
        <td>${fmtDataIso(m.data)}</td>
        <td>
          ${esc(m.descricao)}
          ${m.contaContabil ? `<div class="sub">${esc(m.contaContabil)}</div>` : ""}
        </td>
        <td>${esc(m.contaApelido)}</td>
        <td class="num" style="color:${cor};font-weight:600;">${sinal}${fmtMoeda(m.valor)}</td>
        <td class="num">${fmtMoeda(m.saldo)}</td>
      </tr>`;
    })
    .join("");

  const corpo =
    extrato.movimentos.length > 0
      ? linhas
      : `<tr><td colspan="5" class="vazio">Nenhum movimento no período.</td></tr>`;

  const resumoHtml = `
    <div class="resumo">
      <div class="card"><div class="rot">Saldo inicial</div><div class="val">${fmtMoeda(extrato.saldoInicialPeriodo)}</div></div>
      <div class="card"><div class="rot">Créditos</div><div class="val" style="color:#047857;">${fmtMoeda(extrato.totalCreditos)}</div></div>
      <div class="card"><div class="rot">Débitos</div><div class="val" style="color:#b91c1c;">${fmtMoeda(extrato.totalDebitos)}</div></div>
      <div class="card"><div class="rot">Saldo final</div><div class="val">${fmtMoeda(extrato.saldoFinalPeriodo)}</div></div>
    </div>`;

  const tabelaHtml = `
    <table>
      <thead>
        <tr>
          <th style="width:15%">Data</th>
          <th style="width:37%">Descrição</th>
          <th style="width:20%">Conta</th>
          <th style="width:14%" class="num">Valor</th>
          <th style="width:14%" class="num">Saldo</th>
        </tr>
      </thead>
      <tbody>
        <tr class="linha-saldo">
          <td colspan="4">Saldo inicial do período</td>
          <td class="num">${fmtMoeda(extrato.saldoInicialPeriodo)}</td>
        </tr>
        ${corpo}
        <tr class="linha-saldo">
          <td colspan="4">Saldo final do período</td>
          <td class="num">${fmtMoeda(extrato.saldoFinalPeriodo)}</td>
        </tr>
      </tbody>
    </table>`;

  return abrirRelatorio({
    titulo: "Extrato de conta",
    subtitulo: `<strong>${esc(extrato.contaLabel)}</strong> &nbsp;·&nbsp; Período: ${fmtDataIso(extrato.periodoDe)} a ${fmtDataIso(extrato.periodoAte)}`,
    resumoHtml,
    tabelaHtml,
    rodapeInfo: `${extrato.movimentos.length} lançamento(s)`,
    empresa,
    comTimbrado,
  });
}
