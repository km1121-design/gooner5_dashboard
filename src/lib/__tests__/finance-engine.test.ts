import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildParams,
  computeDeptMonth,
  computeHalfBonuses,
  computeIncentivesEarned,
  computeMemberSummary,
  computeMonth,
  elapsedDays,
} from "../finance-engine";
import { createSeedDatabase } from "../seed";
import type { Database } from "../types";

const db = () => createSeedDatabase();

describe("date helpers", () => {
  it("addMonths crosses year boundary", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2027-01", -1)).toBe("2026-12");
  });
  it("elapsedDays", () => {
    expect(elapsedDays("2026-08", "2026-09-23")).toBe(31);
    expect(elapsedDays("2026-09", "2026-09-23")).toBe(23);
    expect(elapsedDays("2026-10", "2026-09-23")).toBe(0);
  });
});

describe("department PL (2026-08 seed)", () => {
  it("SALES: referral split credited before OP", () => {
    const pl = computeDeptMonth(db(), "SALES", "2026-08");
    expect(pl.grossSales).toBe(950000);
    // 引越し 400,000×80% + 転職 800,000×50%
    expect(pl.referralCredit).toBe(720000);
    expect(pl.sales).toBe(1670000);
    expect(pl.totalCost).toBe(55000 + 430000 + 30000);
    expect(pl.op).toBe(1155000);
    expect(pl.barSales).toBe(870000);
  });

  it("HR: master key 20% and referral debit", () => {
    const pl = computeDeptMonth(db(), "HR", "2026-08");
    expect(pl.grossSales).toBe(2800000);
    expect(pl.referralDebit).toBe(400000);
    expect(pl.masterKeyFee).toBe(560000);
    expect(pl.op).toBe(2400000 - (560000 + 400000 + 2900000 + 150000));
    expect(pl.placements).toBe(5);
  });

  it("internal referrals net to zero company-wide", () => {
    const m = computeMonth(db(), "2026-08");
    // 社内振替は相殺され、社外（引越し）配分のみが全社売上に上乗せされる
    expect(m.total.sales).toBe(m.total.grossSales + 320000);
  });

  it("pending transactions are excluded from PL", () => {
    const pl = computeDeptMonth(db(), "SALES", "2026-09");
    expect(pl.pendingCount).toBe(1);
    expect(pl.grossSales).toBe(480000);
  });
});

describe("incentives", () => {
  it("BAR incentive fires when monthly OP >= threshold, paid next month end", () => {
    const items = computeIncentivesEarned(db(), "2026-08");
    const bar = items.find((i) => i.kind === "BAR")!;
    expect(bar.amount).toBe(87000);
    expect(bar.member_id).toBe("MEM_001");
    expect(bar.pay_month).toBe("2026-09");
  });

  it("BAR incentive does not fire below threshold", () => {
    const d: Database = db();
    d.params.push({ config_key: "sales_bar_inc_threshold", config_value: 5000000, description: "" });
    expect(computeIncentivesEarned(d, "2026-08").some((i) => i.kind === "BAR")).toBe(false);
  });

  it("HR placement allowance: AD 10k / REFERRAL 30k", () => {
    const items = computeIncentivesEarned(db(), "2026-08").filter((i) => i.kind === "HR_PLACEMENT");
    const lisa = items.filter((i) => i.member_id === "MEM_004").reduce((s, i) => s + i.amount, 0);
    const taka = items.filter((i) => i.member_id === "MEM_002").reduce((s, i) => s + i.amount, 0);
    expect(lisa).toBe(10000 + 30000 + 30000);
    expect(taka).toBe(10000 + 30000);
  });

  it("LOGI 10% paid on the 15th two months later", () => {
    const logi = computeIncentivesEarned(db(), "2026-08").find((i) => i.kind === "LOGI_MONTHLY")!;
    expect(logi.amount).toBe(45000); // OP 450,000 × 10%
    expect(logi.pay_month).toBe("2026-10");
    expect(logi.pay_day).toBe("15日");
  });
});

describe("half-year bonuses", () => {
  const params = buildParams(createSeedDatabase().params);

  it("SALES: 10% of OP minus paid BAR when target not met", () => {
    const b = computeHalfBonuses(db(), "H1", "2026-08", false, params).find((x) => x.kind === "SALES_HALF")!;
    expect(b.amount).toBe(1155000 * 0.1 - 87000);
    expect(b.pay_month).toBe("2027-02");
  });

  it("SALES: adds 20% of excess over target", () => {
    const d = db();
    d.params.push({ config_key: "sales_half_target_h1", config_value: 1000000, description: "" });
    const b = computeHalfBonuses(d, "H1", "2026-08", false).find((x) => x.kind === "SALES_HALF")!;
    expect(b.amount).toBe(Math.round(1155000 * 0.1 - 87000 + 155000 * 0.2));
  });

  it("HR: 3% within target, 5% on excess", () => {
    const d = db();
    d.params.push({ config_key: "fixed_cost_hr", config_value: 0, description: "" });
    d.params.push({ config_key: "hr_half_target_h1", config_value: 1000000, description: "" });
    const op = computeDeptMonth(d, "HR", "2026-08").op;
    const b = computeHalfBonuses(d, "H1", "2026-08", false).find((x) => x.kind === "HR_DEPT")!;
    expect(b.amount).toBe(Math.round(1000000 * 0.03 + (op - 1000000) * 0.05));
  });

  it("HR personal PL bonus 15%", () => {
    const b = computeHalfBonuses(db(), "H1", "2026-08", false, params).find((x) => x.kind === "HR_PERSONAL" && x.member_id === "MEM_004")!;
    // 1,800,000 − MK 360,000 − 経費 200,000 − 配賦 200,000 = 1,040,000
    expect(b.amount).toBe(156000);
  });

  it("LOGI pool 5%", () => {
    const b = computeHalfBonuses(db(), "H1", "2026-08", false, params).find((x) => x.kind === "LOGI_POOL")!;
    expect(b.amount).toBe(22500);
  });

  it("forecast mode fills remaining months with plan", () => {
    const actual = computeHalfBonuses(db(), "H1", "2026-08", false, params).find((x) => x.kind === "LOGI_POOL")!;
    const fc = computeHalfBonuses(db(), "H1", "2026-08", true, params).find((x) => x.kind === "LOGI_POOL")!;
    expect(fc.amount).toBeGreaterThan(actual.amount);
  });
});

describe("member summary", () => {
  it("pay this month includes incentives earned last month", () => {
    const s = computeMemberSummary(db(), "MEM_001", "2026-09")!;
    expect(s.payThisMonth.total).toBe(320000 + 87000);
    expect(s.personalSales).toBe(480000 + 500000);
  });
});

describe("configurable payment timing", () => {
  it("pay offsets and day come from parameters", () => {
    const d = db();
    d.params.push({ config_key: "sales_bar_pay_offset", config_value: 2, description: "" });
    d.params.push({ config_key: "logi_inc_pay_offset", config_value: 1, description: "" });
    d.params.push({ config_key: "logi_inc_pay_day", config_value: 0, description: "" });
    d.params.push({ config_key: "half_bonus_pay_offset", config_value: 2, description: "" });
    const items = computeIncentivesEarned(d, "2026-08");
    expect(items.find((i) => i.kind === "BAR")!.pay_month).toBe("2026-10");
    const logi = items.find((i) => i.kind === "LOGI_MONTHLY")!;
    expect(logi.pay_month).toBe("2026-09");
    expect(logi.pay_day).toBe("末日");
    expect(computeHalfBonuses(d, "H1", "2026-08", false)[0].pay_month).toBe("2027-03");
  });

  it("every default parameter has metadata for the settings screen", async () => {
    const { DEFAULT_PARAMS, PARAM_GROUPS } = await import("../constants");
    const keys = new Set<string>();
    for (const p of DEFAULT_PARAMS) {
      expect(PARAM_GROUPS).toContain(p.group);
      expect(keys.has(p.key)).toBe(false);
      keys.add(p.key);
    }
  });
});
