/** 70000 kuruş → "700 ₺", 12550 → "125,50 ₺" */
export function formatPrice(kurus: number): string {
  const lira = kurus / 100;
  const text = lira.toLocaleString("tr-TR", {
    minimumFractionDigits: Number.isInteger(lira) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${text} ₺`;
}
