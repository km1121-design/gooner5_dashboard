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

/** 支給タイミングの表示（例: offset=1, day=0 → 「翌月末」、offset=2, day=15 → 「翌々月15日」） */
export const payTiming = (offset: number, day = 0) => {
  const m = offset === 0 ? "当月" : offset === 1 ? "翌月" : offset === 2 ? "翌々月" : `${offset}ヶ月後の`;
  return day >= 1 && day <= 31 ? `${m}${Math.round(day)}日` : `${m}末`;
};
