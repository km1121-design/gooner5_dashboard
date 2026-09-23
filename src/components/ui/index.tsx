"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// shadcn/ui 風の軽量プリミティブ（依存を増やさないため自前実装）

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-2xl border border-line bg-surface shadow-sm", className)}>{children}</section>;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-bold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong shadow-sm",
  secondary: "bg-surface text-ink border border-line hover:bg-subtle",
  ghost: "text-soft hover:bg-subtle hover:text-ink",
  danger: "bg-surface text-bad border border-bad/30 hover:bg-bad/10",
  success: "bg-good text-white hover:opacity-90 shadow-sm",
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm",
        VARIANTS[variant],
        className,
      )}
    />
  );
}

type Tone = "neutral" | "brand" | "good" | "warn" | "bad" | "violet";
const TONES: Record<Tone, string> = {
  neutral: "bg-subtle text-soft",
  brand: "bg-brand/10 text-brand-strong",
  good: "bg-good/10 text-good",
  warn: "bg-warn/15 text-warn-ink",
  bad: "bg-bad/10 text-bad",
  violet: "bg-violet-500/10 text-violet-700",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold", TONES[tone], className)}>{children}</span>;
}

/** 達成率バッジ。100%以上=good、80%以上=warn、それ未満=bad */
export function RateBadge({ value, className }: { value: number | null; className?: string }) {
  if (value === null) return <span className="text-xs text-faint">—</span>;
  const tone: Tone = value >= 100 ? "good" : value >= 80 ? "warn" : "bad";
  return (
    <Badge tone={tone} className={className}>
      {value}%
    </Badge>
  );
}

export function Progress({ value, className, color }: { value: number; className?: string; color?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-subtle", className)}>
      <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}

export function StatCard({
  label,
  value,
  valueClass,
  footer,
  icon,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  valueClass?: string;
  footer?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-center justify-between text-xs font-semibold text-muted">
        <span>{label}</span>
        {icon && <span className="text-faint">{icon}</span>}
      </div>
      <div className={cn("mt-1.5 text-2xl font-black tracking-tight text-ink tabular-nums sm:text-[1.7rem]", valueClass)}>{value}</div>
      {footer && <div className="mt-3 border-t border-line pt-2.5 text-xs text-soft">{footer}</div>}
    </Card>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn("m-auto w-[calc(100%-2rem)] rounded-2xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm", wide ? "max-w-2xl" : "max-w-md")}
    >
      {open && (
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
            <h3 className="text-base font-bold">{title}</h3>
            <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-subtle hover:text-ink" aria-label="閉じる">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block text-xs font-medium", className)}>
      <span className="mb-1 block text-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-line bg-subtle/60 px-2.5 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(inputCls, "pr-7", className)}>
      {children}
    </select>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-muted">{children}</div>;
}

/** テーブル共通スタイル */
export const T = {
  wrap: "overflow-x-auto",
  table: "w-full text-left text-xs",
  thead: "border-b border-line bg-subtle/70 text-muted",
  th: "px-4 py-2.5 font-semibold whitespace-nowrap",
  tbody: "divide-y divide-line",
  tr: "hover:bg-subtle/60",
  td: "px-4 py-2.5 whitespace-nowrap",
  num: "px-4 py-2.5 text-right tabular-nums whitespace-nowrap",
};
