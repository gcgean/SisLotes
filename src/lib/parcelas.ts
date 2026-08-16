export function rotuloParcela(numero: number, totalAtual: number, recorrente: boolean): string {
  return recorrente ? `Parcela ${numero} · recorrente` : `${numero}/${totalAtual}`;
}
