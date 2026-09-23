export const yen = (v: number | null | undefined) => {
  const n = Math.round(v ?? 0);
  return `${n < 0 ? "−" : ""}¥${Math.abs(n).toLocaleString("ja-JP")}`;
};

/** 会議・チャート用の短縮表記（万円） */
export const man = (v: number | null | undefined) => {
  const n = Math.round((v ?? 0) / 10000);
  return `${n.toLocaleString("ja-JP")}万`;
};

export const signedYen = (v: number) => `${v >= 0 ? "+" : ""}${yen(v)}`;

export const rate = (actual: number, plan: number): number | null => (plan ? Math.round((actual / plan) * 100) : null);

export const pctText = (r: number | null) => (r === null ? "—" : `${r}%`);

export const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-");
  return `${y}年${Number(m)}月`;
};

export const shortMonth = (ym: string) => `${Number(ym.slice(5, 7))}月`;
