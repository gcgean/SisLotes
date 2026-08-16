import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { tabelaParaLinhas, tabelasParaCsv } from "@/lib/table-export";

describe("exportação global de listas", () => {
  it("remove coluna vazia de ações e mantém acentos", () => {
    document.body.innerHTML = `<table><tr><th>Descrição</th><th>Ações</th></tr><tr><td>Comissão São José</td><td><button>Editar</button></td></tr></table>`;
    expect(tabelaParaLinhas(document.querySelector("table")!)).toEqual([
      ["Descrição"],
      ["Comissão São José"],
    ]);
  });

  it("gera CSV compatível com Excel em pt-BR", () => {
    const csv = tabelasParaCsv([{ nome: "Lista", linhas: [["Nome", "Valor"], ["A \"B\"", "1.234,56"]] }]);
    expect(csv).toBe('"Nome";"Valor"\r\n"A ""B""";"1.234,56"');
  });

  it("carrega o gerador XLSX sob demanda", () => {
    const fonte = readFileSync(
      path.join(process.cwd(), "src/components/layout/TableExportMenu.tsx"),
      "utf8",
    );
    expect(fonte).toContain('await import("write-excel-file/browser")');
    expect(fonte).toContain("fileName:`${nomeBase()}.xlsx`");
  });
});
