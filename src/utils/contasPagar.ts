// ─── Utilitário: impressão do relatório de contas a pagar ────────────────────

import type { ReciboEmpresa } from "./reciboParcela";
import { abrirRelatorio, esc, fmtDataIso, fmtMoeda } from "./relatorioBase";

export interface ContaPagarImpressao {
  descricao: string;
  loteamento: string | null;
  categoria: string | null;
  fornecedor: string | null;
  valorTotal: number;
  valorPago: number;
  parcelasPagas: number;
  parcelasTotal: number;
  vencimento: string | null;
  /** true quando a próxima parcela em aberto já venceu. */
  atrasada: boolean;
  recorrente: boolean;
}

export interface ContasPagarImpressao {
  /** Descrição dos filtros aplicados (loteamento, categoria, situação, busca). */
  filtrosLabel: string;
  contas: ContaPagarImpressao[];
}

export function imprimirContasPagar(
  dados: ContasPagarImpressao,
  empresa: ReciboEmpresa | null,
  comTimbrado: boolean = true,
) {
  const { contas } = dados;

  const totalGeral = contas.reduce((a, c) => a + c.valorTotal, 0);
  const totalPago = contas.reduce((a, c) => a + c.valorPago, 0);
  const totalEmAberto = totalGeral - totalPago;
  const qtdAtrasadas = contas.filter((c) => c.atrasada).length;

  const linhas = contas
    .map((c) => {
      const emAberto = c.valorTotal - c.valorPago;
      return `
      <tr>
        <td>
          ${esc(c.descricao)}${c.recorrente ? ' <span class="sub">(recorrente)</span>' : ""}
          ${c.categoria ? `<div class="sub">${esc(c.categoria)}</div>` : ""}
        </td>
        <td>${esc(c.loteamento) || "—"}</td>
        <td>${esc(c.fornecedor) || "—"}</td>
        <td class="num">${c.parcelasPagas}/${c.parcelasTotal}</td>
        <td class="${c.atrasada ? "atrasado" : ""}">${fmtDataIso(c.vencimento)}</td>
        <td class="num">${fmtMoeda(c.valorTotal)}</td>
        <td class="num" style="color:#b91c1c;font-weight:600;">${fmtMoeda(emAberto)}</td>
      </tr>`;
    })
    .join("");

  const corpo =
    contas.length > 0
      ? linhas
      : `<tr><td colspan="7" class="vazio">Nenhuma conta a pagar para os filtros aplicados.</td></tr>`;

  const resumoHtml = `
    <div class="resumo">
      <div class="card"><div class="rot">Contas</div><div class="val">${contas.length}</div></div>
      <div class="card"><div class="rot">Valor total</div><div class="val">${fmtMoeda(totalGeral)}</div></div>
      <div class="card"><div class="rot">Já pago</div><div class="val" style="color:#047857;">${fmtMoeda(totalPago)}</div></div>
      <div class="card"><div class="rot">Em aberto</div><div class="val" style="color:#b91c1c;">${fmtMoeda(totalEmAberto)}</div></div>
      <div class="card"><div class="rot">Atrasadas</div><div class="val" style="color:#b91c1c;">${qtdAtrasadas}</div></div>
    </div>`;

  const tabelaHtml = `
    <table>
      <thead>
        <tr>
          <th style="width:22%">Descrição</th>
          <th style="width:13%">Loteamento</th>
          <th style="width:15%">Fornecedor</th>
          <th style="width:10%" class="num">Parcelas</th>
          <th style="width:14%">Vencimento</th>
          <th style="width:13%" class="num">Valor</th>
          <th style="width:13%" class="num">Em aberto</th>
        </tr>
      </thead>
      <tbody>
        ${corpo}
        <tr class="linha-saldo">
          <td colspan="5">Totais</td>
          <td class="num">${fmtMoeda(totalGeral)}</td>
          <td class="num">${fmtMoeda(totalEmAberto)}</td>
        </tr>
      </tbody>
    </table>`;

  return abrirRelatorio({
    titulo: "Contas a pagar",
    subtitulo: esc(dados.filtrosLabel),
    resumoHtml,
    tabelaHtml,
    rodapeInfo: `${contas.length} conta(s)`,
    empresa,
    comTimbrado,
  });
}
