// Compact number formatting for charts and tiles: 1,284 -> 1.3K, 12,900 -> 13K, $4.2M
export const compact = (n) => {
  const v = Math.abs(n);
  if (v >= 1e6) return `${(n / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (v >= 1e3) return `${(n / 1e3).toFixed(v >= 1e4 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(Math.round(n * 100) / 100);
};

export const money = (n) => `$${compact(n)}`;
