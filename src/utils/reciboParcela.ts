// ─── Utilitário: geração de recibo de pagamento de parcela ───────────────────

export interface ReciboEmpresa {
  nome_fantasia: string;
  cnpj?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  telefone?: string | null;
  email?: string | null;
  logo?: string | null;
}

export interface ReciboParcela {
  id: number;
  cliente: string;
  lote: string;
  loteamento: string;
  numero_parcela: number;
  parcelas: number;
  tipo?: string;
  situacao?: string;
  vencimento: string;
  valor: number;
  pago_data?: string;
  valor_pago?: number;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function buildTimbrado(empresa: ReciboEmpresa | null): string {
  const logoHtml = empresa?.logo
    ? `<img src="${empresa.logo}" alt="Logo" style="max-height:70px;max-width:160px;object-fit:contain;" />`
    : `<div style="width:120px;height:60px;background:#eee;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:10px;color:#666;">LOGO</div>`;

  return `
  <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px;padding-bottom:12px;border-bottom:2px solid #000;">
    ${logoHtml}
    <div style="flex:1;text-align:center;font-size:9.5pt;line-height:1.6;">
      <div style="font-size:13pt;font-weight:bold;">${empresa?.nome_fantasia ?? "IMOBILIÁRIA"}</div>
      ${empresa?.endereco ? `<div>${empresa.endereco}${empresa.bairro ? ` - ${empresa.bairro}` : ""}</div>` : ""}
      ${empresa?.cidade ? `<div>${empresa.cidade}${empresa.estado ? `/${empresa.estado}` : ""}${empresa.telefone ? ` - TEL.: ${empresa.telefone}` : ""}</div>` : ""}
      ${empresa?.cnpj ? `<div>CNPJ: ${empresa.cnpj}</div>` : ""}
      ${empresa?.email ? `<div>${empresa.email}</div>` : ""}
    </div>
  </div>`;
}

export function gerarReciboParcela(
  pag: ReciboParcela,
  dataPago: string,
  valorPago: number,
  multa: number,
  juros: number,
  contaNome: string,
  empresa: ReciboEmpresa | null,
  comTimbrado: boolean = true
) {
  const valorOriginal = pag.valor;
  const temEncargos = multa > 0 || juros > 0;
  const isEntrada = pag.tipo === "entrada" || pag.numero_parcela === 0;

  const tituloDoc = isEntrada
    ? "Recibo de Entrada"
    : "Recibo de Pagamento de Parcela";

  const descricaoParcela = isEntrada
    ? `Entrada — ${pag.loteamento ? pag.loteamento + " — " : ""}${pag.lote}`
    : `Parcela ${pag.numero_parcela}/${pag.parcelas} — ${pag.loteamento ? pag.loteamento + " — " : ""}${pag.lote}`;

  const labelParcela = isEntrada
    ? "Entrada"
    : `${pag.numero_parcela}/${pag.parcelas}`;

  const timbrado = comTimbrado ? buildTimbrado(empresa) : "";

  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${tituloDoc}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; background: #fff; padding: 15mm 20mm; }
    .titulo { text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; }
    .numero { text-align: center; font-size: 10pt; color: #555; margin-bottom: 24px; }
    .bloco { border: 1px solid #ccc; border-radius: 4px; padding: 14px 18px; margin-bottom: 16px; }
    .bloco-titulo { font-size: 9pt; font-weight: bold; text-transform: uppercase; color: #555; margin-bottom: 10px; letter-spacing: 0.5px; }
    .linha { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; font-size: 10.5pt; }
    .linha .label { color: #555; }
    .linha .valor { font-weight: 600; text-align: right; }
    .linha-destaque { border-top: 1.5px solid #000; margin-top: 10px; padding-top: 10px; font-size: 12pt; font-weight: bold; }
    .assinatura { margin-top: 50px; display: flex; justify-content: center; gap: 80px; }
    .ass-box { text-align: center; }
    .ass-linha { width: 200px; border-top: 1px solid #000; margin: 0 auto 6px; }
    .ass-label { font-size: 9.5pt; color: #444; }
    .btn-print {
      display: block; margin: 28px auto 0;
      padding: 10px 32px; background: #1a56db; color: #fff;
      font-size: 12pt; font-family: Arial, sans-serif;
      border: none; border-radius: 6px; cursor: pointer;
    }
    .btn-print:hover { background: #1e429f; }
    @media print { @page { margin: 0; } body { padding: 15mm 20mm; } .btn-print { display: none; } }
  </style>
</head>
<body>
  ${timbrado}

  <div class="titulo">${tituloDoc}</div>
  <div class="numero">${descricaoParcela}</div>

  <div class="bloco">
    <div class="bloco-titulo">Dados do Cliente</div>
    <div class="linha"><span class="label">Cliente:</span><span class="valor">${pag.cliente}</span></div>
    <div class="linha"><span class="label">Loteamento:</span><span class="valor">${pag.loteamento || "—"}</span></div>
    <div class="linha"><span class="label">Lote:</span><span class="valor">${pag.lote}</span></div>
  </div>

  <div class="bloco">
    <div class="bloco-titulo">Dados do Pagamento</div>
    <div class="linha"><span class="label">Referente:</span><span class="valor">${labelParcela}</span></div>
    <div class="linha"><span class="label">Data do Pagamento:</span><span class="valor">${dataPago}</span></div>
    <div class="linha"><span class="label">Valor:</span><span class="valor">${fmt(valorOriginal)}</span></div>
    ${temEncargos ? `
    <div class="linha"><span class="label">Multa (2%):</span><span class="valor">${fmt(multa)}</span></div>
    <div class="linha"><span class="label">Juros (0,20%/dia):</span><span class="valor">${fmt(juros)}</span></div>` : ""}
    <div class="linha linha-destaque"><span class="label">Total Pago:</span><span class="valor">${fmt(valorPago)}</span></div>
    ${contaNome ? `<div class="linha" style="margin-top:8px;"><span class="label">Conta:</span><span class="valor">${contaNome}</span></div>` : ""}
  </div>

  <div class="assinatura">
    <div class="ass-box">
      <div class="ass-linha"></div>
      <div class="ass-label">Responsável pelo Recebimento</div>
    </div>
    <div class="ass-box">
      <div class="ass-linha"></div>
      <div class="ass-label">Cliente — ${pag.cliente}</div>
    </div>
  </div>

  <button class="btn-print" onclick="this.style.display='none'; window.print();">Imprimir Recibo</button>
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) return;
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
}
