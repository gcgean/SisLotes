// ─── Utilitário: impressão do extrato de conta ───────────────────────────────
// Segue o mesmo padrão do recibo de parcela: monta o HTML, abre em nova janela
// e deixa o usuário disparar a impressão.

import type { ReciboEmpresa } from "./reciboParcela";

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

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function fmtData(iso: string) {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

/** Escapa texto vindo do banco antes de injetar no HTML da janela de impressão. */
function esc(v: string | null | undefined) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildTimbrado(empresa: ReciboEmpresa | null): string {
  const logoHtml = empresa?.logo
    ? `<img src="${esc(empresa.logo)}" alt="Logo" style="max-height:70px;max-width:160px;object-fit:contain;" />`
    : `<div style="width:120px;height:60px;background:#eee;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:10px;color:#666;">LOGO</div>`;

  return `
  <div style="display:flex;align-items:center;gap:20px;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #000;">
    ${logoHtml}
    <div style="flex:1;text-align:center;font-size:9.5pt;line-height:1.6;">
      <div style="font-size:13pt;font-weight:bold;">${esc(empresa?.nome_fantasia) || "IMOBILIÁRIA"}</div>
      ${empresa?.endereco ? `<div>${esc(empresa.endereco)}${empresa.bairro ? ` - ${esc(empresa.bairro)}` : ""}</div>` : ""}
      ${empresa?.cidade ? `<div>${esc(empresa.cidade)}${empresa.estado ? `/${esc(empresa.estado)}` : ""}${empresa.telefone ? ` - TEL.: ${esc(empresa.telefone)}` : ""}</div>` : ""}
      ${empresa?.cnpj ? `<div>CNPJ: ${esc(empresa.cnpj)}</div>` : ""}
      ${empresa?.email ? `<div>${esc(empresa.email)}</div>` : ""}
    </div>
  </div>`;
}

export function imprimirExtratoConta(
  extrato: ExtratoImpressao,
  empresa: ReciboEmpresa | null,
  comTimbrado: boolean = true,
) {
  const timbrado = comTimbrado ? buildTimbrado(empresa) : "";

  const linhas = extrato.movimentos
    .map((m) => {
      const sinal = m.movimento === "entrada" ? "+" : "−";
      const cor = m.movimento === "entrada" ? "#059669" : "#dc2626";
      return `
      <tr>
        <td>${fmtData(m.data)}</td>
        <td>
          ${esc(m.descricao)}
          ${m.contaContabil ? `<div class="sub">${esc(m.contaContabil)}</div>` : ""}
        </td>
        <td>${esc(m.contaApelido)}</td>
        <td class="num" style="color:${cor};font-weight:600;">${sinal}${fmt(m.valor)}</td>
        <td class="num">${fmt(m.saldo)}</td>
      </tr>`;
    })
    .join("");

  const corpo =
    extrato.movimentos.length > 0
      ? linhas
      : `<tr><td colspan="5" style="text-align:center;padding:24px;color:#666;">Nenhum movimento no período.</td></tr>`;

  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<!-- viewport + text-size-adjust: sem isso o Chromium/Edge aplica "font boosting"
     na janela de impressão e o documento sai com a fonte gigante. -->
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Extrato de conta — ${esc(extrato.contaLabel)}</title>
<style>
  html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt; line-height: 1.35; color: #111; background: #f1f5f9;
    padding: 16px;
  }
  /* Folha do relatório: largura de A4 e nunca maior que a janela. */
  .folha { width: 210mm; max-width: 100%; margin: 0 auto; background: #fff; padding: 14mm; }

  .doc-titulo { font-size: 13pt; font-weight: bold; text-transform: uppercase; letter-spacing: .5px; }
  .doc-sub { font-size: 9pt; color: #555; margin-top: 2px; }
  .cabecalho { border-bottom: 1.5px solid #111; padding-bottom: 8px; margin-bottom: 12px; }

  .resumo { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
  .card { flex: 1 1 120px; min-width: 0; border: 1px solid #d4d4d8; border-radius: 4px; padding: 7px 9px; }
  .card .rot { font-size: 7.5pt; color: #555; text-transform: uppercase; letter-spacing: .04em; }
  .card .val { font-size: 11pt; font-weight: bold; margin-top: 2px; white-space: nowrap; }

  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { padding: 5px 6px; text-align: left; vertical-align: top; word-wrap: break-word; }
  thead th {
    background: #f1f5f9; font-size: 8pt; text-transform: uppercase; letter-spacing: .04em;
    color: #444; border-bottom: 1px solid #94a3b8;
  }
  tbody td { border-bottom: 1px solid #e5e7eb; font-size: 9pt; }
  tbody tr:nth-child(even) td { background: #fafafa; }
  .num { text-align: right; }
  .sub { font-size: 7.5pt; color: #666; margin-top: 1px; }
  .linha-saldo td { background: #f1f5f9 !important; font-weight: bold; font-size: 9pt; }
  .c-data { width: 15%; } .c-desc { width: 37%; } .c-conta { width: 20%; }
  .c-valor { width: 14%; } .c-saldo { width: 14%; }

  .rodape { margin-top: 14px; padding-top: 8px; border-top: 1px solid #d4d4d8;
            font-size: 8pt; color: #666; display: flex; justify-content: space-between; gap: 12px; }

  .btn-print {
    position: fixed; top: 10px; right: 10px; z-index: 10;
    padding: 8px 14px; background: #059669; color: #fff;
    border: none; border-radius: 5px; cursor: pointer;
    font-family: Arial, Helvetica, sans-serif; font-size: 10pt;
  }

  @media print {
    @page { size: A4; margin: 12mm; }
    body { background: #fff; padding: 0; font-size: 9.5pt; }
    .folha { width: auto; max-width: none; margin: 0; padding: 0; }
    .btn-print { display: none !important; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <button class="btn-print" onclick="window.print();">Imprimir</button>

  <div class="folha">
    ${timbrado}

    <div class="cabecalho">
      <div class="doc-titulo">Extrato de conta</div>
      <div class="doc-sub">
        <strong>${esc(extrato.contaLabel)}</strong>
        &nbsp;·&nbsp; Período: ${fmtData(extrato.periodoDe)} a ${fmtData(extrato.periodoAte)}
      </div>
    </div>

    <div class="resumo">
      <div class="card"><div class="rot">Saldo inicial</div><div class="val">${fmt(extrato.saldoInicialPeriodo)}</div></div>
      <div class="card"><div class="rot">Créditos</div><div class="val" style="color:#047857;">${fmt(extrato.totalCreditos)}</div></div>
      <div class="card"><div class="rot">Débitos</div><div class="val" style="color:#b91c1c;">${fmt(extrato.totalDebitos)}</div></div>
      <div class="card"><div class="rot">Saldo final</div><div class="val">${fmt(extrato.saldoFinalPeriodo)}</div></div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="c-data">Data</th>
          <th class="c-desc">Descrição</th>
          <th class="c-conta">Conta</th>
          <th class="c-valor num">Valor</th>
          <th class="c-saldo num">Saldo</th>
        </tr>
      </thead>
      <tbody>
        <tr class="linha-saldo">
          <td colspan="4">Saldo inicial do período</td>
          <td class="num">${fmt(extrato.saldoInicialPeriodo)}</td>
        </tr>
        ${corpo}
        <tr class="linha-saldo">
          <td colspan="4">Saldo final do período</td>
          <td class="num">${fmt(extrato.saldoFinalPeriodo)}</td>
        </tr>
      </tbody>
    </table>

    <div class="rodape">
      <!-- Sem timbrado o papel já é o da empresa: não repetir o nome dela aqui. -->
      <span>${comTimbrado && empresa?.nome_fantasia ? `${esc(empresa.nome_fantasia)} — ` : ""}Extrato de conta</span>
      <span>Emitido em ${new Date().toLocaleString("pt-BR")} · ${extrato.movimentos.length} lançamento(s)</span>
    </div>
  </div>
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=1024,height=800");
  if (!printWindow) return false;
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  return true;
}
