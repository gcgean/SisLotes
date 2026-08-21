// ─── Base compartilhada dos relatórios impressos ─────────────────────────────
// Concentra o CSS e a abertura da janela para que todo relatório saia no mesmo
// padrão — e para que correções (ex.: o "font boosting" do Edge, que exige
// viewport + text-size-adjust e conteúdo que não estoure a janela) valham para
// todos de uma vez.

import type { ReciboEmpresa } from "./reciboParcela";

export const fmtMoeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/** Converte "YYYY-MM-DD" para "DD/MM/YYYY". */
export function fmtDataIso(iso: string | null | undefined) {
  if (!iso) return "—";
  const [a, m, d] = String(iso).slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : String(iso);
}

/** Escapa texto vindo do banco antes de injetar no HTML da janela de impressão. */
export function esc(v: string | null | undefined) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildTimbrado(empresa: ReciboEmpresa | null): string {
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

export const CSS_RELATORIO = `
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
  /* Totais no fim: espaço acima e sem margem embaixo (o rodapé vem logo após). */
  .resumo-fim { margin-top: 14px; }
  .resumo-fim .resumo { margin-bottom: 0; }
  .resumo-titulo { font-size: 8.5pt; font-weight: bold; text-transform: uppercase;
                   letter-spacing: .04em; color: #444; margin-bottom: 6px; }
  .card { flex: 1 1 120px; min-width: 0; border: 1px solid #d4d4d8; border-radius: 4px; padding: 7px 9px; }
  .card .rot { font-size: 7.5pt; color: #555; text-transform: uppercase; letter-spacing: .04em; }
  .card .val { font-size: 11pt; font-weight: bold; margin-top: 2px; white-space: nowrap; }

  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th, td { padding: 5px 6px; text-align: left; vertical-align: top; word-wrap: break-word; }
  thead th {
    background: #f1f5f9; font-size: 8pt; text-transform: uppercase; letter-spacing: .02em;
    color: #444; border-bottom: 1px solid #94a3b8;
    /* Sem isso, com table-layout fixo, títulos longos quebram no meio da
       palavra ("VENCIMENT/O"). */
    white-space: nowrap;
  }
  tbody td { border-bottom: 1px solid #e5e7eb; font-size: 9pt; }
  tbody tr:nth-child(even) td { background: #fafafa; }
  .num { text-align: right; }
  .sub { font-size: 7.5pt; color: #666; margin-top: 1px; }
  .linha-saldo td { background: #f1f5f9 !important; font-weight: bold; font-size: 9pt; }
  .vazio { text-align: center; padding: 24px; color: #666; }
  .atrasado { color: #b91c1c; font-weight: 600; }

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
`;

export interface RelatorioOpcoes {
  /** Vai para o <title> da janela e para o cabeçalho do documento. */
  titulo: string;
  /** Linha logo abaixo do título (conta, período, filtros aplicados…). */
  subtitulo: string;
  /** HTML dos cards de resumo (opcional). */
  resumoHtml?: string;
  /**
   * Onde os totalizadores aparecem em relação à tabela. "fim" fecha o
   * relatório com os totais, que é como se espera ler um documento contábil.
   */
  resumoPosicao?: "inicio" | "fim";
  /** HTML da tabela principal. */
  tabelaHtml: string;
  /** Texto à direita no rodapé (ex.: "12 lançamento(s)"). */
  rodapeInfo?: string;
  empresa: ReciboEmpresa | null;
  comTimbrado: boolean;
}

/**
 * Monta o HTML do relatório e abre a janela de impressão.
 * Devolve false quando o pop-up foi bloqueado pelo navegador.
 */
export function abrirRelatorio(opcoes: RelatorioOpcoes): boolean {
  const { titulo, subtitulo, resumoHtml, resumoPosicao = "inicio", tabelaHtml, rodapeInfo, empresa, comTimbrado } = opcoes;
  const timbrado = comTimbrado ? buildTimbrado(empresa) : "";
  const resumo = resumoHtml ?? "";
  const corpo =
    resumoPosicao === "fim"
      ? `${tabelaHtml}\n    <div class="resumo-fim">${resumo}</div>`
      : `${resumo}\n    ${tabelaHtml}`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<!-- viewport + text-size-adjust: sem isso o Chromium/Edge aplica "font boosting"
     na janela de impressão e o documento sai com a fonte gigante. -->
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(titulo)}</title>
<style>${CSS_RELATORIO}</style>
</head>
<body>
  <button class="btn-print" onclick="window.print();">Imprimir</button>

  <div class="folha">
    ${timbrado}

    <div class="cabecalho">
      <div class="doc-titulo">${esc(titulo)}</div>
      <div class="doc-sub">${subtitulo}</div>
    </div>

    ${corpo}

    <div class="rodape">
      <!-- Sem timbrado o papel já é o da empresa: não repetir o nome dela aqui. -->
      <span>${comTimbrado && empresa?.nome_fantasia ? `${esc(empresa.nome_fantasia)} — ` : ""}${esc(titulo)}</span>
      <span>Emitido em ${new Date().toLocaleString("pt-BR")}${rodapeInfo ? ` · ${rodapeInfo}` : ""}</span>
    </div>
  </div>
</body>
</html>`;

  const janela = window.open("", "_blank", "width=1024,height=800");
  if (!janela) return false;
  janela.document.write(html);
  janela.document.close();
  janela.focus();
  return true;
}
