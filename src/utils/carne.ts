// ─── Utilitário compartilhado: geração de carnê (modelo detalhado) ───────────
// Usado tanto na tela de Vendas quanto na de Pagamentos para manter o mesmo
// padrão: cada parcela vira um carnê com 2 vias (Cliente / Empresa), código de
// barras e campos de encargos. Layout fixo em 3 carnês (parcelas) por folha A4.

export interface CarneEmpresa {
  nome_fantasia?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  telefone?: string | null;
}

export interface CarneSlip {
  idVenda: number;
  numero_parcela: number;
  totalParcelas: number;
  vencimentoFmt: string; // já formatado dd/mm/aaaa
  valor: number;
  cliente: string;
  loteamentoNome: string;
  loteNum: string;
  quadraNum: string;
  enderecoLoteamento?: string;
  jurosPct?: number;
  situacao?: string;
  reajustado?: boolean;
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/**
 * Abre uma janela de impressão com o carnê detalhado.
 * Retorna false se o popup foi bloqueado (o chamador exibe o aviso).
 */
export function imprimirCarneDetalhado(
  empresa: CarneEmpresa | null,
  parcelas: CarneSlip[],
  tituloVenda: string,
): boolean {
  if (parcelas.length === 0) return true;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return false;

  const empNome = empresa?.nome_fantasia || "EMPRESA";
  const enderecoEmp = [
    empresa?.endereco,
    empresa?.bairro,
    [empresa?.cidade, empresa?.estado].filter(Boolean).join(" - "),
  ].filter(Boolean).join(", ");

  function buildSlip(p: CarneSlip, via: string): string {
    const docNum = `${String(p.idVenda).padStart(6, "0")}${String(p.numero_parcela).padStart(2, "0")}`;
    const isPago = p.situacao === "pago";
    const jurosPct = p.jurosPct ?? 1;
    return `
      <div class="carne${isPago ? " pago" : ""}">
        <div class="header">
          <div class="empresa-nome">${empNome}</div>
          ${empresa?.cnpj ? `<div class="empresa-sub">CNPJ: ${empresa.cnpj}</div>` : ""}
          ${enderecoEmp ? `<div class="empresa-sub">${enderecoEmp}${empresa?.telefone ? ` · Tel: ${empresa.telefone}` : ""}</div>` : ""}
          <div class="via-label">${via}</div>
        </div>
        ${isPago ? `<div class="pago-overlay">PAGO</div>` : ""}
        <div class="field-row">
          <div class="field full"><span class="flabel">CLIENTE</span><span class="fvalue">${p.cliente}</span></div>
        </div>
        <div class="field-row grid3">
          <div class="field"><span class="flabel">LOTE</span><span class="fvalue">${p.loteNum}${p.loteamentoNome ? ` — ${p.loteamentoNome}` : ""}</span></div>
          <div class="field"><span class="flabel">QUADRA</span><span class="fvalue">${p.quadraNum}</span></div>
          <div class="field"><span class="flabel">PARCELA</span><span class="fvalue bold">${String(p.numero_parcela).padStart(2, "0")} / ${String(p.totalParcelas).padStart(2, "0")}</span></div>
        </div>
        <div class="field-row grid3">
          <div class="field"><span class="flabel">DOCUMENTO</span><span class="fvalue">${docNum}</span></div>
          <div class="field"><span class="flabel">VENCIMENTO</span><span class="fvalue">${p.vencimentoFmt}</span></div>
          <div class="field"><span class="flabel">VALOR</span><span class="fvalue bold">${fmtBRL(p.valor)}</span></div>
        </div>
        <div class="field-row">
          <div class="field full"><span class="flabel">ENDEREÇO DO LOTEAMENTO</span><span class="fvalue">${p.enderecoLoteamento || p.loteamentoNome}</span></div>
        </div>
        <div class="instrucoes">Após o vencimento cobrar juros de ${jurosPct}% ao mês e multa de 2% sobre o valor da parcela.</div>
        <div class="calc-section">
          <div class="calc-row"><span class="calc-label">(+) Juros</span><span class="calc-line"></span></div>
          <div class="calc-row"><span class="calc-label">(+) Multa</span><span class="calc-line"></span></div>
          <div class="calc-row total-row"><span class="calc-label bold">(=) Valor Cobrado</span><span class="calc-line"></span></div>
        </div>
        <div class="barcode-area">
          <div class="barcode">*${docNum}*</div>
          <div class="barcode-num">${docNum}</div>
        </div>
      </div>`;
  }

  // Agrupa em páginas de 3 parcelas (cada parcela = 1 linha com 2 vias)
  let pagesHTML = "";
  for (let i = 0; i < parcelas.length; i += 3) {
    const slice = parcelas.slice(i, i + 3);
    const rows = slice.map((p) => `
      <div class="row-pair">
        ${buildSlip(p, "1ª Via — Cliente")}
        ${buildSlip(p, "2ª Via — Empresa")}
      </div>`).join("");
    pagesHTML += `<div class="page">${rows}</div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<title>${tituloVenda}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4 portrait; margin: 0; }
  body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #000; padding: 8mm; }
  .page { height: 280mm; display: flex; flex-direction: column; gap: 4mm; page-break-after: always; }
  .page:last-child { page-break-after: avoid; }
  .row-pair { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .carne { border: 1px dashed #555; border-radius: 3px; padding: 5px 8px; font-size: 8px; position: relative; overflow: hidden; display: flex; flex-direction: column; }
  .carne.pago { opacity: 0.7; }
  .header { border-bottom: 1.5px solid #222; margin-bottom: 3px; padding-bottom: 2px; text-align: center; }
  .empresa-nome { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
  .empresa-sub { font-size: 6.5px; color: #444; }
  .via-label { font-size: 6.5px; font-style: italic; color: #666; margin-top: 1px; }
  .pago-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-25deg); font-size: 26px; font-weight: bold; color: rgba(22,163,74,0.22); border: 4px solid rgba(22,163,74,0.22); padding: 2px 10px; pointer-events: none; white-space: nowrap; }
  .field-row { display: flex; gap: 4px; margin-bottom: 2px; }
  .field-row.grid3 { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 4px; margin-bottom: 2px; }
  .field { display: flex; flex-direction: column; min-width: 0; }
  .field.full { flex: 1; }
  .flabel { font-weight: bold; font-size: 6px; color: #555; text-transform: uppercase; }
  .fvalue { font-size: 7.5px; border-bottom: 1px solid #aaa; padding-bottom: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fvalue.bold { font-weight: bold; font-size: 8.5px; }
  .instrucoes { font-size: 6px; color: #555; border: 0.5px solid #ccc; padding: 2px 4px; margin: 2px 0; line-height: 1.3; }
  .calc-section { margin: 2px 0; }
  .calc-row { display: flex; align-items: flex-end; gap: 4px; margin-bottom: 2px; }
  .calc-label { font-size: 6.5px; white-space: nowrap; min-width: 80px; }
  .calc-label.bold { font-weight: bold; }
  .calc-line { flex: 1; border-bottom: 1px solid #333; height: 8px; }
  .total-row .calc-line { border-bottom: 2px solid #000; }
  .barcode-area { text-align: center; margin-top: auto; padding-top: 2px; border-top: 1px solid #ddd; }
  .barcode { font-family: 'Libre Barcode 39', cursive; font-size: 30px; line-height: 1; }
  .barcode-num { font-size: 6.5px; letter-spacing: 2px; font-family: 'Courier New', monospace; }
</style>
</head>
<body>
${pagesHTML}
<script>
  function imprimir() { setTimeout(function(){ window.print(); }, 120); }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function(){ setTimeout(imprimir, 150); });
  } else {
    setTimeout(imprimir, 500);
  }
</script>
</body>
</html>`;

  win.document.write(html);
  win.document.close();
  win.focus();
  return true;
}
