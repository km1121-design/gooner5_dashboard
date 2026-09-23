"use client";

import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Maximize2,
  Minimize2,
  Moon,
  Plus,
  RefreshCw,
  Settings,
  Sun,
  Truck,
  UserRound,
  Users,
  Wine,
  LineChart as LineIcon,
  ClipboardCheck,
  LogOut,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, Empty } from "@/components/ui";
import { DEPT_META, TERM_MONTHS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { BusinessDept, Dept } from "@/lib/types";
import { api, useDashboard } from "./api";
import { ApprovalsTab } from "./approvals";
import { DeptTab } from "./dept";
import { MasterTab } from "./master";
import { AddTransactionModal, ExpenseModal, ReferralModal } from "./modals";
import { OverviewTab } from "./overview";
import { PersonalTab } from "./personal";
import { DailyTab, TrendTab } from "./trend-daily";

type TabKey = "overview" | "trend" | "daily" | "sales" | "hr" | "logi" | "personal" | "approvals" | "master";

const DEPT_ICON: Record<BusinessDept, typeof Wine> = { SALES: Wine, HR: Users, LOGI: Truck };

export function Dashboard() {
  const [month, setMonth] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey | null>(null);
  const [meeting, setMeeting] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const [modal, setModal] = useState<null | { kind: "tx" } | { kind: "ref" } | { kind: "exp"; dept: Dept }>(null);
  const [toast, setToast] = useState<{ msg: string; error?: boolean; id: number } | null>(null);
  const { data, error, loading, reload } = useDashboard(month);

  const notify = (msg: string, isError?: boolean) => setToast({ msg, error: isError, id: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    document.documentElement.classList.toggle("meeting", meeting);
  }, [meeting]);

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
  }, [theme]);

  const tabs = useMemo(() => {
    if (!data) return [];
    const list: { key: TabKey; label: string; icon: typeof Wine; badge?: number }[] = [];
    if (data.scope.length) {
      list.push({ key: "overview", label: "PL概要", icon: BarChart3 });
      list.push({ key: "trend", label: "月次推移", icon: LineIcon });
      list.push({ key: "daily", label: "日次進捗", icon: CalendarDays });
      for (const d of data.scope.filter((x): x is BusinessDept => x !== "HQ")) {
        list.push({ key: d.toLowerCase() as TabKey, label: DEPT_META[d].short, icon: DEPT_ICON[d] });
      }
    }
    list.push({ key: "personal", label: data.me.role === "ADMIN" ? "個人PL・給与" : "私の給与見立て", icon: UserRound });
    if (data.permissions.approve) list.push({ key: "approvals", label: "承認", icon: ClipboardCheck, badge: data.approvals.length + data.referralApprovals.length });
    if (data.permissions.master) list.push({ key: "master", label: "マスター設定", icon: Settings });
    return list;
  }, [data]);

  const activeTab: TabKey | undefined = tabs.find((t) => t.key === tab)?.key ?? tabs[0]?.key;

  async function switchUser(id: string) {
    try {
      await api("/api/session", "POST", { member_id: id });
      setTab(null);
      await reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), true);
    }
  }

  function toggleMeeting() {
    const next = !meeting;
    setMeeting(next);
    if (next) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-sm text-muted">
        {error ? (
          <div className="max-w-md rounded-xl border border-bad/30 bg-surface p-6 text-center">
            <div className="font-bold text-bad">データを読み込めませんでした</div>
            <div className="mt-2 text-soft">{error}</div>
            <Button className="mt-4" variant="secondary" onClick={reload}>
              再試行
            </Button>
          </div>
        ) : (
          <Loader2 className="animate-spin" />
        )}
      </div>
    );
  }

  const currentMonth = data.month;
  const isDark = theme ? theme === "dark" : typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-lg font-black text-white">G</span>
            <div>
              <h1 className="text-sm font-black leading-tight sm:text-base">Gooner 第5期 PLダッシュボード</h1>
              <div className="text-[11px] text-muted">
                {data.dataSource === "sheets" ? "Google Sheets 連携中" : "ローカルデータ（Sheets未接続）"} ・ {data.me.name}（{data.me.role}）
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={currentMonth}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-bold text-ink"
              aria-label="対象月"
            >
              {TERM_MONTHS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}（{m.half === "H1" ? "上期" : "下期"}）
                </option>
              ))}
            </select>

            {data.authMode === "dev" && !meeting && (
              <select
                value={data.me.member_id}
                onChange={(e) => switchUser(e.target.value)}
                className="no-print rounded-lg border border-dashed border-line bg-subtle px-2.5 py-1.5 text-xs text-soft"
                aria-label="視点切替（開発用）"
                title="視点切替（開発用）"
              >
                {data.switchableMembers.map((m) => (
                  <option key={m.member_id} value={m.member_id}>
                    視点: {m.name}（{m.role}）
                  </option>
                ))}
              </select>
            )}

            <div className="no-print flex items-center gap-1">
              <button className="rounded-lg p-2 text-muted hover:bg-subtle hover:text-ink" onClick={reload} title="再読み込み" aria-label="再読み込み">
                <RefreshCw size={16} className={cn(loading && "animate-spin")} />
              </button>
              <button className="rounded-lg p-2 text-muted hover:bg-subtle hover:text-ink" onClick={() => setTheme(isDark ? "light" : "dark")} title="テーマ切替" aria-label="テーマ切替">
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              {data.authMode === "google" && (
                <form action="/api/auth/logout" method="post">
                  <button type="submit" className="rounded-lg p-2 text-muted hover:bg-subtle hover:text-ink" title="ログアウト" aria-label="ログアウト">
                    <LogOut size={16} />
                  </button>
                </form>
              )}
              {data.scope.length > 0 && (
                <button className="rounded-lg p-2 text-muted hover:bg-subtle hover:text-ink" onClick={toggleMeeting} title="会議モード（全画面・拡大表示）" aria-label="会議モード">
                  {meeting ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
              )}
            </div>

            {!meeting && (
              <Button size="sm" className="no-print" onClick={() => setModal({ kind: "tx" })}>
                <Plus size={14} />
                実績を報告
              </Button>
            )}
          </div>
        </div>

        <nav className="no-print mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 text-sm sm:px-6">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 font-semibold transition-colors",
                  activeTab === t.key ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink",
                )}
              >
                <Icon size={15} />
                {t.label}
                {!!t.badge && <span className="rounded-full bg-warn px-1.5 text-[10px] font-black text-white">{t.badge}</span>}
              </button>
            );
          })}
        </nav>
      </header>

      <main className={cn("mx-auto max-w-7xl space-y-6 px-4 pt-6 sm:px-6", loading && "opacity-70 transition-opacity")}>
        {activeTab === "overview" && <OverviewTab data={data} onGoto={(t) => setTab(t as TabKey)} />}
        {activeTab === "trend" && (
          <TrendTab
            data={data}
            onSelectMonth={setMonth}
            onOpenMonth={(m) => {
              setMonth(m);
              setTab("overview");
            }}
          />
        )}
        {activeTab === "daily" && <DailyTab data={data} />}
        {(activeTab === "sales" || activeTab === "hr" || activeTab === "logi") && (
          <DeptTab
            data={data}
            dept={activeTab.toUpperCase() as BusinessDept}
            onAddExpense={() => setModal({ kind: "exp", dept: activeTab.toUpperCase() as Dept })}
            onAddReferral={() => setModal({ kind: "ref" })}
          />
        )}
        {activeTab === "personal" && <PersonalTab key={data.me.member_id} data={data} />}
        {activeTab === "approvals" && <ApprovalsTab data={data} onChanged={reload} notify={notify} />}
        {activeTab === "master" && data.master && <MasterTab key={`${data.me.member_id}`} data={data} onSaved={reload} notify={notify} />}
        {!activeTab && <Empty>表示できる画面がありません</Empty>}
      </main>

      {modal?.kind === "tx" && <AddTransactionModal open onClose={() => setModal(null)} data={data} onDone={reload} notify={notify} />}
      {modal?.kind === "ref" && <ReferralModal open onClose={() => setModal(null)} data={data} onDone={reload} notify={notify} />}
      {modal?.kind === "exp" && <ExpenseModal open onClose={() => setModal(null)} data={data} dept={modal.dept} onDone={reload} notify={notify} />}

      {toast && (
        <div
          key={toast.id}
          role="status"
          className={cn(
            "fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-xl",
            toast.error ? "bg-bad" : "bg-ink text-surface",
          )}
        >
          {!toast.error && <CheckCircle2 size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
