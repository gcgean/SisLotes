export interface TabelaExportavel { nome: string; linhas: string[][] }

function textoCelula(celula: HTMLTableCellElement) {
  const clone = celula.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("button,svg,[aria-label='Ações']").forEach((el) => el.remove());
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function tabelaParaLinhas(tabela: HTMLTableElement): string[][] {
  const linhas = Array.from(tabela.rows).map((linha) => Array.from(linha.cells).map(textoCelula));
  if (!linhas.length) return [];
  const maior = Math.max(...linhas.map((linha) => linha.length));
  const manter = Array.from({ length: maior }, (_, indice) => {
    const nome = linhas[0]?.[indice]?.trim().toLocaleLowerCase("pt-BR") ?? "";
    const colunaDeAcoesVazia = ["ações", "acoes", ""].includes(nome)
      && linhas.slice(1).every((linha) => !linha[indice]?.trim());
    return !colunaDeAcoesVazia && linhas.some((linha) => Boolean(linha[indice]?.trim()));
  });
  return linhas.map((linha) => linha.filter((_, indice) => manter[indice]));
}

export function coletarTabelasVisiveis(root: HTMLElement): TabelaExportavel[] {
  return Array.from(root.querySelectorAll("table"))
    .filter((tabela) => !tabela.closest('[hidden],[aria-hidden="true"]') && getComputedStyle(tabela).display !== "none")
    .map((tabela, indice) => ({ nome: tabela.getAttribute("aria-label") || `Lista ${indice + 1}`, linhas: tabelaParaLinhas(tabela) }))
    .filter((tabela) => tabela.linhas.length > 1);
}

const escaparCsv = (valor: string) => `"${valor.replace(/"/g, '""')}"`;
export function tabelasParaCsv(tabelas: TabelaExportavel[]) {
  return tabelas.flatMap((tabela, indice) => [ ...(indice ? [""] : []), ...(tabelas.length > 1 ? [[tabela.nome]] : []), ...tabela.linhas ]).map((linha) => linha.map(escaparCsv).join(";")).join("\r\n");
}

export function baixarTexto(conteudo: string, nome: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const link = document.createElement("a"); link.href = url; link.download = nome; link.click(); URL.revokeObjectURL(url);
}
