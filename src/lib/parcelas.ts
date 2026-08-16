export function rotuloParcela(numero: number, totalAtual: number, recorrente: boolean): string {
  return recorrente ? `Parcela ${numero} · recorrente` : `${numero}/${totalAtual}`;
}

export function gerarPreviewParcelas(valorTotal: number, quantidade: number, primeiroVencimento: string) {
  if (valorTotal <= 0 || quantidade <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(primeiroVencimento)) return [];
  const totalCentavos = Math.round(valorTotal * 100);
  const base = Math.floor(totalCentavos / quantidade);
  const resto = totalCentavos - base * quantidade;
  const [ano, mes, dia] = primeiroVencimento.split("-").map(Number);
  return Array.from({ length: quantidade }, (_, indice) => {
    const data = new Date(ano, mes - 1 + indice, 1);
    const ultimoDia = new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
    const vencimento = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(Math.min(dia, ultimoDia)).padStart(2, "0")}`;
    return { numero: indice + 1, vencimento, valor: (base + (indice === quantidade - 1 ? resto : 0)) / 100 };
  });
}
