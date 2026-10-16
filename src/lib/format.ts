export function formatM2(x: number | undefined) {
  return `${(x ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} m²`;
}

export function formatEuros(x: number) {
  return x.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}
