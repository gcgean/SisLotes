// ─── Utilitário: impressão dos documentos de fechamento de período ───────────
// Usa o layout compartilhado de relatorioBase, com os totalizadores no fim.

import type { ReciboEmpresa } from "./reciboParcela";
import { abrirRelatorio, esc, fmtDataIso, fmtMoeda } from "./relatorioBase";

export interface MovimentoFechamento {
  data: string;
  tipo: "receita" | "despesa";
  descricao: string;
  conta: string;
  loteamento: string;
  origem?: string;
  valor: number;
}

export interface ExtratoFechamentoImpressao {
  contaLabel: string;
  periodoDe: string;
  periodoAte: string;
  saldoInicial: number;
  entradas: number;
  saidas: number;
  saldoFinal: number;
  variacaoCaixa: number;
  contasReceberPendentes: number;
  contasPagarPendentes: number;
  saldoNaoConsolidado: number;
  movimentos: MovimentoFechamento[];
}

function card(rot: string, valor: number, cor?: string) {
  return `<div class="card"><div class="rot">${esc(rot)}</div><div class="val"${cor ? ` style="color:${cor};"` : ""}>${fmtMoeda(valor)}</div></div>`;
}

function linhasMovimentos(movimentos: MovimentoFechamento[], colunas: number) {
  if (movimentos.length === 0) {
    return `<tr><td colspan="${colunas}" class="vazio">Nenhum movimento no período.</td></tr>`;
  }
  return movimentos
    .map((m) => {
      const receita = m.tipo === "receita";
      const cor = receita ? "#047857" : "#b91c1c";
      const colunaLoteamento = colunas === 5 ? `<td>${esc(m.loteamento) || "—"}</td>` : "";
      return `
      <tr>
        <td>${fmtDataIso(m.data)}</td>
        <td>
          ${esc(m.descricao)}
          ${m.origem ? `<div class="sub">${esc(m.origem)}</div>` : ""}
        </td>
        <td>${esc(m.conta)}</td>
        ${colunaLoteamento}
        <td class="num" style="color:${cor};font-weight:600;">${receita ? "+" : "−"}${fmtMoeda(m.valor)}</td>
      </tr>`;
    })
    .join("");
}

export function imprimirExtratoFechamento(
  e: ExtratoFechamentoImpressao,
  empresa: ReciboEmpresa | null,
  comTimbrado: boolean = true,
) {
  const acumulou = e.variacaoCaixa >= 0;

  const resumoHtml = `
    <div class="resumo-titulo">Totais do período</div>
    <div class="resumo">
      ${card("Saldo inicial", e.saldoInicial)}
      ${card("Entradas", e.entradas, "#047857")}
      ${card("Saídas", e.saidas, "#b91c1c")}
      ${card("Saldo final", e.saldoFinal)}
    </div>
    <div class="resumo" style="margin-top:8px;">
      ${card("A receber não recebido", e.contasReceberPendentes, "#047857")}
      ${card("A pagar não pago", e.contasPagarPendentes, "#b91c1c")}
      ${card("Ainda não consolidado", e.saldoNaoConsolidado, e.saldoNaoConsolidado < 0 ? "#b91c1c" : "#047857")}
      <div class="card">
        <div class="rot">${acumulou ? "O período acumulou caixa" : "O período queimou caixa"}</div>
        <div class="val" style="color:${acumulou ? "#047857" : "#b91c1c"};">${fmtMoeda(e.variacaoCaixa)}</div>
      </div>
    </div>`;

  const tabelaHtml = `
    <table>
      <thead>
        <tr>
          <th style="width:13%">Data</th>
          <th style="width:33%">Descrição</th>
          <th style="width:20%">Conta</th>
          <th style="width:20%">Loteamento</th>
          <th style="width:14%" class="num">Valor</th>
        </tr>
      </thead>
      <tbody>
        <tr class="linha-saldo">
          <td colspan="4">Saldo inicial do período</td>
          <td class="num">${fmtMoeda(e.saldoInicial)}</td>
        </tr>
        ${linhasMovimentos(e.movimentos, 5)}
        <tr class="linha-saldo">
          <td colspan="4">Saldo final do período</td>
          <td class="num">${fmtMoeda(e.saldoFinal)}</td>
        </tr>
      </tbody>
    </table>`;

  return abrirRelatorio({
    titulo: "Extrato de fechamento",
    subtitulo: `<strong>${esc(e.contaLabel)}</strong> &nbsp;·&nbsp; Período: ${fmtDataIso(e.periodoDe)} a ${fmtDataIso(e.periodoAte)}`,
    resumoHtml,
    resumoPosicao: "fim",
    tabelaHtml,
    rodapeInfo: `${e.movimentos.length} lançamento(s)`,
    empresa,
    comTimbrado,
  });
}

export interface RelatorioFechamentoImpressao {
  idRelatorio: number;
  empresaNome: string;
  contaLabel: string;
  periodoDe: string;
  periodoAte: string;
  saldoInicial: number;
  entradas: number;
  saidas: number;
  saldoFinal: number;
  lancamentos: MovimentoFechamento[];
}

export function imprimirRelatorioFechamento(
  r: RelatorioFechamentoImpressao,
  empresa: ReciboEmpresa | null,
  comTimbrado: boolean = true,
) {
  const resumoHtml = `
    <div class="resumo-titulo">Totais do período</div>
    <div class="resumo">
      ${card("Saldo inicial", r.saldoInicial)}
      ${card("Créditos", r.entradas, "#047857")}
      ${card("Débitos", r.saidas, "#b91c1c")}
      ${card("Saldo final", r.saldoFinal)}
    </div>`;

  const tabelaHtml = `
    <table>
      <thead>
        <tr>
          <th style="width:15%">Data</th>
          <th style="width:45%">Descrição</th>
          <th style="width:24%">Conta</th>
          <th style="width:16%" class="num">Valor</th>
        </tr>
      </thead>
      <tbody>
        <tr class="linha-saldo">
          <td colspan="3">Saldo inicial do período</td>
          <td class="num">${fmtMoeda(r.saldoInicial)}</td>
        </tr>
        ${linhasMovimentos(r.lancamentos, 4)}
        <tr class="linha-saldo">
          <td colspan="3">Saldo final do período</td>
          <td class="num">${fmtMoeda(r.saldoFinal)}</td>
        </tr>
      </tbody>
    </table>`;

  return abrirRelatorio({
    titulo: `Relatório de fechamento #${r.idRelatorio}`,
    subtitulo: `<strong>${esc(r.contaLabel)}</strong> &nbsp;·&nbsp; ${esc(r.empresaNome)} &nbsp;·&nbsp; Período: ${fmtDataIso(r.periodoDe)} a ${fmtDataIso(r.periodoAte)}`,
    resumoHtml,
    resumoPosicao: "fim",
    tabelaHtml,
    rodapeInfo: `${r.lancamentos.length} lançamento(s)`,
    empresa,
    comTimbrado,
  });
}
