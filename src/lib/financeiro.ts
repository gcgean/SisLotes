export interface MovimentoFinanceiroValor {
  tipo: "receita" | "despesa";
  valor: number;
}

export function consolidarMovimentos(movimentos: MovimentoFinanceiroValor[]) {
  const receita = movimentos.filter((m) => m.tipo === "receita").reduce((total, m) => total + m.valor, 0);
  const despesa = movimentos.filter((m) => m.tipo === "despesa").reduce((total, m) => total + m.valor, 0);
  return { receita, despesa, resultado: receita - despesa };
}

export function contaRecebimentoValida(idConta: string): boolean {
  return /^\d+$/.test(idConta) && Number(idConta) > 0;
}
