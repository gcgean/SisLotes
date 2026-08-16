import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { gerarPreviewParcelas } from "@/lib/parcelas";

const raiz = resolve(__dirname, "../..");
const fonte = (path: string) => readFileSync(resolve(raiz, path), "utf8");

describe("usabilidade financeira — fase 4", () => {
  it("permite acionar salvar e exibe validações inline", () => {
    const despesas = fonte("src/pages/Despesas.tsx");
    expect(despesas).toContain("setTentouSalvarDespesa(true)");
    expect(despesas).toContain("Informe a descrição.");
    expect(despesas).toContain("Selecione uma categoria.");
    expect(despesas).toContain("Informe um valor maior que zero.");
    expect(despesas).toContain("disabled={salvarDespesaMutation.isPending}");
  });

  it("mantém o rodapé do modal e ações da tabela visíveis", () => {
    const despesas = fonte("src/pages/Despesas.tsx");
    expect(despesas).toContain('DialogFooter className="sticky bottom-0');
    expect(despesas).toContain("sticky right-0 bg-muted/95");
  });

  it("libera o ponteiro ao fechar overlays e respeita adiamento do PWA", () => {
    expect(fonte("src/components/ui/dialog.tsx")).toContain("data-[state=closed]:pointer-events-none");
    expect(fonte("src/components/ui/alert-dialog.tsx")).toContain("data-[state=closed]:pointer-events-none");
    const pwa = fonte("src/components/PWAInstallBanner.tsx");
    expect(pwa).toContain('sislote:pwa-dismissed-until');
    expect(pwa).toContain("7 * 24 * 60 * 60 * 1000");
  });

  it("trata margem sem receita e gráfico sem resultado como estados vazios", () => {
    const visao = fonte("src/components/financeiro/VisaoGeralTab.tsx");
    expect(visao).toContain('receita === 0 ? "—"');
    expect(visao).toContain('resultadoLoteamento.every((item) => item.resultado === 0)');
  });

  it("abre recebíveis consolidados e oferece extrato pesquisável e exportável", () => {
    const pagamentos = fonte("src/pages/Pagamentos.tsx");
    expect(pagamentos).toContain('searchParams.get("view") === "cliente" ? "cliente" : "lote"');
    expect(pagamentos).toContain('value="lote">Visão geral');
    const extrato = fonte("src/components/financeiro/LancamentosTab.tsx");
    expect(extrato).toContain("function exportarCsv()");
    expect(extrato).toContain("Buscar descrição, conta ou categoria");
    expect(extrato).toContain("Somente créditos");
  });

  it("liga a conta operacional ao cadastro bancário completo", () => {
    expect(fonte("src/components/financeiro/ContasTab.tsx")).toContain('/configuracoes?tab=contas');
    expect(fonte("src/pages/Configuracoes.tsx")).toContain("abaConfiguracao");
  });

  it("gera prévia mensal preservando centavos e datas civis", () => {
    expect(gerarPreviewParcelas(100, 3, "2026-01-31")).toEqual([
      { numero: 1, vencimento: "2026-01-31", valor: 33.33 },
      { numero: 2, vencimento: "2026-02-28", valor: 33.33 },
      { numero: 3, vencimento: "2026-03-31", valor: 33.34 },
    ]);
  });
});
