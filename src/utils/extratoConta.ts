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
<title>Extrato — ${esc(extrato.contaLabel)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111; margin: 0; padding: 16px; }
  h1 { font-size: 14pt; margin: 0 0 2px; }
  .meta { font-size: 9.5pt; color: #444; margin-bottom: 14px; }
  .resumo { display: flex; gap: 8px; margin-bottom: 14px; }
  .card { flex: 1; border: 1px solid #ddd; border-radius: 6px; padding: 8px 10px; }
  .card .rot { font-size: 8pt; color: #666; text-transform: uppercase; letter-spacing: .04em; }
  .card .val { font-size: 11pt; font-weight: bold; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #f3f4f6; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .04em;
             color: #444; text-align: left; padding: 7px 8px; border-bottom: 1px solid #ddd; }
  tbody td { padding: 7px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .sub { font-size: 8pt; color: #666; margin-top: 1px; }
  tfoot td, .saldo-linha td { background: #fafafa; font-weight: bold; }
  .btn-print { position: fixed; top: 12px; right: 12px; padding: 8px 16px; background: #059669;
               color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 10pt; }
  @media print { .btn-print { display: none !important; } }
</style>
</head>
<body>
  ${timbrado}

  <h1>Extrato — ${esc(extrato.contaLabel)}</h1>
  <div class="meta">
    Período: ${fmtData(extrato.periodoDe)} a ${fmtData(extrato.periodoAte)}
    · Emitido em ${new Date().toLocaleString("pt-BR")}
  </div>

  <div class="resumo">
    <div class="card"><div class="rot">Saldo inicial</div><div class="val">${fmt(extrato.saldoInicialPeriodo)}</div></div>
    <div class="card"><div class="rot">Créditos</div><div class="val" style="color:#059669;">${fmt(extrato.totalCreditos)}</div></div>
    <div class="card"><div class="rot">Débitos</div><div class="val" style="color:#dc2626;">${fmt(extrato.totalDebitos)}</div></div>
    <div class="card"><div class="rot">Saldo final</div><div class="val">${fmt(extrato.saldoFinalPeriodo)}</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Data</th><th>Descrição</th><th>Conta</th>
        <th class="num">Valor</th><th class="num">Saldo</th>
      </tr>
    </thead>
    <tbody>
      <tr class="saldo-linha">
        <td colspan="4"><em>Saldo inicial do período</em></td>
        <td class="num">${fmt(extrato.saldoInicialPeriodo)}</td>
      </tr>
      ${corpo}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4"><em>Saldo final do período</em></td>
        <td class="num">${fmt(extrato.saldoFinalPeriodo)}</td>
      </tr>
    </tfoot>
  </table>

  <button class="btn-print" onclick="this.style.display='none'; window.print();">Imprimir Extrato</button>
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=1000,height=760");
  if (!printWindow) return false;
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  return true;
}
