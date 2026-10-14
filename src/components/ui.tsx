import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cx } from "../lib/utils";
import { useApp, flushSave } from "../lib/store";
import { IconAlert, IconCheck, IconInfo, IconX } from "./icons";

/* ---------------- 按钮 ---------------- */

type BtnVariant = "primary" | "dark" | "ghost" | "outline" | "danger" | "seal";

export function Btn({
  variant = "outline",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const styles: Record<BtnVariant, string> = {
    primary: "bg-brand-600 text-white hover:bg-brand-700",
    dark: "bg-brand-700 text-white hover:bg-brand-800",
    ghost: "text-ink-600 hover:bg-ink-900/5 hover:text-ink-900",
    outline:
      "border border-ink-200 bg-white/70 text-ink-800 hover:border-ink-300 hover:bg-white",
    danger:
      "border border-danger-600/30 bg-danger-100/60 text-danger-700 hover:bg-danger-100",
    seal: "bg-seal-500 text-white hover:bg-seal-600",
  };
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-sm px-3.5 py-2 text-[14px] font-medium leading-5 transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45",
        styles[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* ---------------- 弹窗 ---------------- */

export function Modal({
  open,
  onClose,
  children,
  width = "max-w-lg",
  bare,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: string;
  bare?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const controls = () =>
      [
        ...(dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]'
        ) ?? []),
      ].filter((el) => el.getClientRects().length > 0);
    const frame = requestAnimationFrame(() =>
      (controls()[0] ?? dialogRef.current)?.focus()
    );
    const onKey = (e: KeyboardEvent) => {
      const dialogs = document.querySelectorAll("[data-app-dialog]");
      if (dialogs[dialogs.length - 1] !== dialogRef.current) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const fields = controls();
        const first = fields[0];
        const last = fields[fields.length - 1];
        if (!fields.length) {
          e.preventDefault();
          dialogRef.current?.focus();
        } else if (
          e.shiftKey &&
          (document.activeElement === first ||
            !dialogRef.current?.contains(document.activeElement))
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !dialogRef.current?.contains(document.activeElement))
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 bg-ink-950/55 backdrop-blur-[2px]"
          onClick={onClose}
        />
        <motion.div
          ref={dialogRef}
          data-app-dialog
          role="dialog"
          aria-modal="true"
          aria-label="简历操作对话框"
          tabIndex={-1}
          initial={{ opacity: 0, scale: 0.96, y: 6 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
            transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] },
          }}
          exit={{
            opacity: 0,
            scale: 0.97,
            y: 4,
            transition: { duration: 0.15, ease: "easeIn" },
          }}
          className={cx(
            "relative w-full overflow-hidden rounded-xl bg-paper-25 shadow-2xl shadow-ink-950/30 ring-1 ring-ink-900/10",
            width
          )}
        >
          {bare ? (
            children
          ) : (
            <div className="max-h-[86vh] overflow-y-auto">{children}</div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export function ModalHeader({
  title,
  sub,
  onClose,
}: {
  title: ReactNode;
  sub?: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
      <div>
        <h3 className="font-display text-[17px] font-bold text-ink-900">
          {title}
        </h3>
        {sub && <p className="mt-0.5 text-xs text-ink-400">{sub}</p>}
      </div>
      {onClose && (
        <button onClick={onClose} className="tool-btn -mr-1" aria-label="关闭">
          <IconX size={16} />
        </button>
      )}
    </div>
  );
}

/* ---------------- 确认弹窗 ---------------- */

export function Confirm({
  open,
  title,
  desc,
  confirmText = "确认",
  danger,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  desc?: ReactNode;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal open={open} onClose={onCancel} width="max-w-sm">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <span
            className={cx(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              danger
                ? "bg-danger-100 text-danger-600"
                : "bg-seal-100 text-seal-600"
            )}
          >
            <IconAlert size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-ink-900">{title}</h3>
            {desc && (
              <div className="mt-1 text-[13px] leading-relaxed text-ink-500">
                {desc}
              </div>
            )}
            {children}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Btn variant="ghost" onClick={onCancel}>
            取消
          </Btn>
          <Btn variant={danger ? "danger" : "primary"} onClick={onConfirm}>
            {confirmText}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- 开关 ---------------- */

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200",
        checked ? "bg-brand-600" : "bg-ink-200"
      )}
    >
      <span
        className={cx(
          "absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200",
          checked ? "translate-x-[18px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

/* ---------------- 评分环 ---------------- */

export function ScoreRing({
  score,
  size = 92,
  label,
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color =
    score >= 75
      ? "var(--color-brand-600)"
      : score >= 50
      ? "var(--color-seal-500)"
      : "var(--color-danger-600)";
  return (
    <div className="relative inline-flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * score) / 100}
          style={{
            ["--ring-c" as string]: `${c}`,
            transition: "stroke-dashoffset .2s",
          }}
          className="anim-ring-draw"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono text-[22px] font-bold leading-none"
          style={{ color }}
        >
          {score}
        </span>
        {label && (
          <span className="mt-1 text-[10px] text-ink-400">{label}</span>
        )}
      </div>
    </div>
  );
}

export function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 75
      ? "bg-brand-500"
      : score >= 50
      ? "bg-seal-500"
      : "bg-danger-600";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-ink-500">{label}</span>
        <span className="font-mono font-bold text-ink-800">{score}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-paper-200">
        <div
          className={cx("anim-bar-grow h-full rounded-full", color)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

/* ---------------- Toast ---------------- */

export function ToastHost() {
  const toasts = useApp((s) => s.toasts);
  const dismiss = useApp((s) => s.dismissToast);
  const iconOf = {
    ok: <IconCheck size={14} />,
    warn: <IconAlert size={14} />,
    err: <IconAlert size={14} />,
    info: <IconInfo size={14} />,
  };
  const toneOf = {
    ok: "border-brand-200 bg-brand-50 text-brand-800",
    warn: "border-seal-500/25 bg-seal-100 text-seal-700",
    err: "border-danger-600/25 bg-danger-100 text-danger-700",
    info: "border-ink-200 bg-white text-ink-700",
  };
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-80 flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 32 }}
            animate={{
              opacity: 1,
              x: 0,
              transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
            }}
            exit={{
              opacity: 0,
              x: 32,
              transition: { duration: 0.18, ease: "easeIn" },
            }}
            className={cx(
              "pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[12.5px] font-medium shadow-lg shadow-ink-950/10",
              toneOf[t.kind]
            )}
          >
            <span className="mt-0.5 shrink-0">{iconOf[t.kind]}</span>
            <span className="min-w-0 flex-1 leading-snug">{t.msg}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 opacity-50 transition hover:opacity-100"
              aria-label="关闭提示"
            >
              <IconX size={12} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- 自动保存状态指示 ---------------- */

export function SaveIndicator() {
  const lastSavedAt = useApp((s) => s.lastSavedAt);
  const saveStatus = useApp((s) => s.saveStatus);
  const [flash, setFlash] = useState(false);
  const prev = useRef(lastSavedAt);
  useEffect(() => {
    if (lastSavedAt && lastSavedAt !== prev.current) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 900);
      prev.current = lastSavedAt;
      return () => clearTimeout(t);
    }
    prev.current = lastSavedAt;
  }, [lastSavedAt]);

  if (saveStatus === "error")
    return (
      <span role="alert" className="text-[11px] text-danger-700">
        保存失败，请下载备份并检查浏览器存储空间{" "}
        <button className="underline" onClick={flushSave}>
          重试保存
        </button>
      </span>
    );
  if (saveStatus === "saving")
    return (
      <span role="status" className="text-[11px] text-ink-400">
        正在保存…
      </span>
    );
  if (!lastSavedAt)
    return <span className="font-mono text-[11px] text-ink-300">尚未修改</span>;
  const d = new Date(lastSavedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 font-mono text-[11px] transition-colors duration-300",
        flash ? "text-brand-600" : "text-ink-400"
      )}
    >
      <span
        className={cx(
          "h-1.5 w-1.5 rounded-full",
          flash ? "anim-pulse-dot bg-brand-500" : "bg-brand-400"
        )}
      />
      已自动保存 {pad(d.getHours())}:{pad(d.getMinutes())}:{pad(d.getSeconds())}
    </span>
  );
}

/* ---------------- 空状态 ---------------- */

export function Empty({
  icon,
  title,
  desc,
  children,
  accent,
}: {
  icon: ReactNode;
  title: string;
  desc?: string;
  children?: ReactNode;
  accent?: "ai";
}) {
  return (
    <div className="anim-fade-up flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-white/40 px-6 py-10 text-center">
      <span
        className={cx(
          "mb-3 flex h-12 w-12 items-center justify-center rounded-xl",
          accent === "ai"
            ? "ai-breathe text-white"
            : "bg-paper-200 text-ink-400"
        )}
        style={
          accent === "ai"
            ? {
                backgroundImage:
                  "linear-gradient(135deg, var(--color-sp-a), var(--color-sp-b) 55%, var(--color-sp-c))",
              }
            : undefined
        }
      >
        {icon}
      </span>
      <p className="text-[14px] font-bold text-ink-800">{title}</p>
      {desc && (
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-ink-400">
          {desc}
        </p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
